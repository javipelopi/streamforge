pub mod commands;
pub mod credentials;
pub mod db;
pub mod matcher;
pub mod scheduler;
pub mod server;
pub mod xmltv;
pub mod xtream;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

#[cfg(desktop)]
use tauri_plugin_autostart::MacosLauncher;

// Constants
const MAIN_WINDOW_NAME: &str = "main";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_shell::init());

    // Initialize desktop-only plugins (autostart, dialog, updater, process)
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                Some(vec!["--minimized"]),
            ))
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder.setup(|app| {
            // Initialize database
            let db_path = db::get_db_path(app)?;
            let database_url = db_path.to_string_lossy().to_string();

            // Establish connection and run migrations
            let mut conn = db::establish_connection(&database_url)
                .map_err(|e| format!("Failed to connect to database: {}", e))?;
            db::run_migrations(&mut conn)
                .map_err(|e| format!("Failed to run migrations: {}", e))?;

            // Create connection pool and store for later use by commands
            let db_connection = db::DbConnection::new(database_url)
                .map_err(|e| format!("Failed to create connection pool: {}", e))?;

            // Story 6-3: Log application startup event (AC #1)
            {
                use commands::logs::log_event_internal;
                if let Ok(mut log_conn) = db_connection.get_connection() {
                    let details = serde_json::json!({
                        "version": env!("CARGO_PKG_VERSION"),
                    });
                    let _ = log_event_internal(
                        &mut log_conn,
                        "info",
                        "system",
                        &format!("StreamForge v{} started", env!("CARGO_PKG_VERSION")),
                        Some(&details.to_string()),
                    );
                }
            }

            // Get app data directory for credential retrieval in stream proxy
            let app_data_dir = app.path()
                .app_data_dir()
                .map_err(|_| "Failed to get app data directory".to_string())?;

            // Create HTTP server state with database pool and app data dir
            let server_state = server::create_app_state_with_dir(
                db_connection.clone_pool(),
                app_data_dir
            );

            // Spawn HTTP server in background - MUST use tauri::async_runtime
            // Server runs independently of GUI and continues when window is hidden
            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::start_server(server_state).await {
                    eprintln!("HTTP server error: {}", e);
                }
            });

            // Initialize EPG scheduler
            // Clone pool for scheduler - scheduler runs independently of commands
            let scheduler_pool = db_connection.clone_pool();
            let epg_scheduler = scheduler::EpgScheduler::new();

            // Spawn scheduler initialization in background
            let scheduler_clone = epg_scheduler.clone();
            tauri::async_runtime::spawn(async move {
                // Set up database pool
                scheduler_clone.set_db_pool(scheduler_pool).await;

                // Start the scheduler
                if let Err(e) = scheduler_clone.start().await {
                    tracing::error!(
                        "CRITICAL: Failed to start EPG scheduler: {}. Automatic EPG refresh will not work!",
                        e
                    );
                    eprintln!("Failed to start EPG scheduler: {}. Automatic EPG refresh will not work!", e);
                    return;
                }
                tracing::info!("EPG scheduler started successfully");

                // Get a temporary connection to read schedule settings
                if let Some(mut conn) = scheduler_clone.get_db_connection().await {
                    let schedule = scheduler::get_epg_schedule(&mut conn);

                    // Set enabled state
                    if let Err(e) = scheduler_clone.set_enabled(schedule.enabled).await {
                        tracing::error!("Failed to set scheduler enabled state: {}. Using default enabled state.", e);
                        eprintln!("Failed to set scheduler enabled state: {}", e);
                    }

                    // Update schedule if enabled
                    if schedule.enabled {
                        if let Err(e) = scheduler_clone.update_schedule(schedule.hour, schedule.minute).await {
                            tracing::error!(
                                "Failed to configure EPG schedule ({:02}:{:02}): {}. Automatic refresh will not work!",
                                schedule.hour,
                                schedule.minute,
                                e
                            );
                            eprintln!("Failed to update EPG schedule: {}", e);
                        } else {
                            tracing::info!(
                                "EPG scheduler configured: refresh at {:02}:{:02} daily",
                                schedule.hour,
                                schedule.minute
                            );
                        }
                    } else {
                        tracing::info!("EPG automatic refresh is disabled in settings");
                    }

                    // Wait 7 seconds after scheduler initialization before checking for missed refresh
                    // This ensures the schedule is fully configured before checking for missed refreshes
                    tokio::time::sleep(tokio::time::Duration::from_secs(7)).await;

                    // Check for missed refresh and trigger if needed
                    // This must happen AFTER schedule is configured to detect missed refreshes correctly
                    scheduler::check_and_trigger_missed_refresh(&scheduler_clone).await;
                } else {
                    tracing::error!(
                        "CRITICAL: Failed to get database connection for scheduler initialization. Automatic EPG refresh will not work!"
                    );
                    eprintln!("Failed to get database connection for scheduler initialization");
                }
            });

            // Store scheduler in managed state for commands to access
            app.manage(epg_scheduler);

            app.manage(db_connection);

            // Create tray menu items
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Build tray icon with menu and event handlers
            // Note: Tray icon is optional - app continues if creation fails
            // Use template icon for macOS tray (black silhouette, adapts to light/dark mode)
            // On other platforms, use the default window icon
            let tray_icon = {
                #[cfg(target_os = "macos")]
                {
                    // Load template icon for macOS - black silhouette that adapts to menubar light/dark mode
                    // Icon is bundled with the app and resolved from resources
                    app.path()
                        .resolve("icons/tray-iconTemplate@2x.png", tauri::path::BaseDirectory::Resource)
                        .ok()
                        .and_then(|path| tauri::image::Image::from_path(path).ok())
                }
                #[cfg(not(target_os = "macos"))]
                {
                    app.default_window_icon().cloned()
                }
            };

            if let Some(icon) = tray_icon {
                // On macOS, mark as template so it adapts to light/dark menubar automatically
                #[cfg(target_os = "macos")]
                let tray_builder = TrayIconBuilder::new()
                    .icon(icon)
                    .icon_as_template(true)
                    .menu(&menu)
                    .show_menu_on_left_click(false);

                #[cfg(not(target_os = "macos"))]
                let tray_builder = TrayIconBuilder::new()
                    .icon(icon)
                    .menu(&menu)
                    .show_menu_on_left_click(false);

                match tray_builder
                    // Left click shows window, right click shows menu
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window(MAIN_WINDOW_NAME) {
                                if let Err(e) = window.unminimize() {
                                    eprintln!("Failed to unminimize window: {}", e);
                                }
                                if let Err(e) = window.show() {
                                    eprintln!("Failed to show window: {}", e);
                                }
                                if let Err(e) = window.set_focus() {
                                    eprintln!("Failed to focus window: {}", e);
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window(MAIN_WINDOW_NAME) {
                                // Explicitly check visibility state vs error state
                                match window.is_visible() {
                                    Ok(true) => {
                                        if let Err(e) = window.hide() {
                                            eprintln!("Failed to hide window: {}", e);
                                        }
                                    }
                                    Ok(false) => {
                                        if let Err(e) = window.unminimize() {
                                            eprintln!("Failed to unminimize window: {}", e);
                                        }
                                        if let Err(e) = window.show() {
                                            eprintln!("Failed to show window: {}", e);
                                        }
                                        if let Err(e) = window.set_focus() {
                                            eprintln!("Failed to focus window: {}", e);
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("Failed to check window visibility: {}", e);
                                    }
                                }
                            }
                        }
                    })
                    .build(app)
                {
                    Ok(_tray) => {
                        println!("System tray icon created successfully");
                    }
                    Err(e) => {
                        eprintln!("Failed to create system tray icon: {}. App will continue without tray functionality.", e);
                    }
                }
            } else {
                eprintln!("No tray icon available. App will continue without tray functionality.");
            }

            // Handle --minimized startup flag (used when autostart launches the app)
            // Window starts hidden by default (visible: false in tauri.conf.json)
            // Only show window if NOT started with --minimized flag
            let args: Vec<String> = std::env::args().collect();
            let start_minimized = args.iter().any(|arg| arg == "--minimized");

            if !start_minimized {
                // Normal startup - show the window
                if let Some(window) = app.get_webview_window(MAIN_WINDOW_NAME) {
                    if let Err(e) = window.show() {
                        eprintln!("Failed to show window on normal start: {}", e);
                    }
                }
            } else {
                // Minimized startup - window stays hidden, only tray icon visible
                println!("App started minimized (--minimized flag detected)");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Hide window on close instead of quitting
                match window.hide() {
                    Ok(_) => {
                        api.prevent_close();
                    }
                    Err(e) => {
                        eprintln!("Failed to hide window on close: {}. Preventing close anyway.", e);
                        api.prevent_close();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_setting,
            commands::set_setting,
            commands::get_server_port,
            commands::set_server_port,
            commands::restart_server,
            commands::get_autostart_enabled,
            commands::set_autostart_enabled,
            commands::get_plex_config,
            commands::accounts::add_account,
            commands::accounts::get_accounts,
            commands::accounts::delete_account,
            commands::accounts::update_account,
            commands::accounts::test_connection,
            commands::channels::scan_channels,
            commands::channels::scan_and_rematch,
            commands::channels::get_channels,
            commands::channels::get_channel_count,
            commands::epg::add_xmltv_source,
            commands::epg::get_xmltv_sources,
            commands::epg::update_xmltv_source,
            commands::epg::delete_xmltv_source,
            commands::epg::toggle_xmltv_source,
            commands::epg::refresh_epg_source,
            commands::epg::refresh_all_epg_sources,
            commands::epg::get_epg_stats,
            commands::epg::get_xmltv_channels,
            commands::epg::get_programs,
            commands::epg::get_epg_schedule,
            commands::epg::set_epg_schedule,
            commands::epg::get_enabled_channels_with_programs,
            commands::epg::search_epg_programs,
            commands::epg::get_channel_stream_info,
            commands::epg::get_program_by_id,
            commands::matcher::run_channel_matching,
            commands::matcher::get_match_stats,
            commands::matcher::get_channel_mappings_for_xmltv,
            commands::matcher::get_xmltv_channel_settings,
            commands::matcher::get_match_threshold,
            commands::matcher::set_match_threshold,
            commands::matcher::normalize_channel_name,
            commands::matcher::calculate_match_score,
            commands::matcher::detect_provider_changes,
            commands::matcher::auto_rematch_new_streams,
            commands::matcher::handle_removed_streams,
            commands::matcher::handle_changed_streams,
            commands::xmltv_channels::get_xmltv_channels_with_mappings,
            commands::xmltv_channels::set_primary_stream,
            commands::xmltv_channels::toggle_xmltv_channel,
            commands::xmltv_channels::update_channel_order,
            commands::xmltv_channels::get_all_xtream_streams,
            commands::xmltv_channels::search_xtream_streams,
            commands::xmltv_channels::add_manual_stream_mapping,
            commands::xmltv_channels::remove_stream_mapping,
            commands::xmltv_channels::bulk_toggle_channels,
            commands::xmltv_channels::get_orphan_xtream_streams,
            commands::xmltv_channels::promote_orphan_to_plex,
            commands::xmltv_channels::update_synthetic_channel,
            commands::xmltv_channels::get_target_lineup_channels,
            commands::xmltv_channels::get_xmltv_channels_for_source,
            commands::xtream_sources::get_xtream_streams_for_account,
            commands::xtream_sources::get_account_stream_stats,
            commands::xtream_sources::unlink_xtream_stream,
            commands::logs::log_event,
            commands::logs::get_events,
            commands::logs::get_unread_event_count,
            commands::logs::mark_event_read,
            commands::logs::mark_all_events_read,
            commands::logs::clear_old_events,
            commands::logs::get_log_verbosity,
            commands::logs::set_log_verbosity,
            // Configuration export/import commands (Story 6-2)
            commands::config::export_configuration,
            commands::config::validate_import_file,
            commands::config::import_configuration,
            // Update commands (Story 6-5)
            commands::update::check_for_update,
            commands::update::get_update_settings,
            commands::update::set_auto_check_updates,
            commands::update::download_and_install_update,
            commands::update::get_current_version,
            // Test data commands (only functional when IPTV_TEST_MODE=1)
            commands::test_data::seed_stream_proxy_test_data,
            commands::test_data::clear_stream_proxy_test_data,
            commands::test_data::create_test_xmltv_channel,
            commands::test_data::set_xmltv_channel_enabled,
            commands::test_data::create_test_program,
            commands::test_data::delete_test_channel_data,
            commands::test_data::create_test_channel_mapping,
            commands::test_data::delete_test_stream_mapping
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    // Prevent exit when window is closed (no explicit exit code)
                    api.prevent_exit();
                }
                // Allow exit when code is Some (explicit quit from tray menu)
            }
        });
}
