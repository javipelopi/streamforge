pub mod commands;
pub mod credentials;
pub mod db;
pub mod server;

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

    // Initialize autostart plugin only on desktop platforms
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ));
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

            // Create HTTP server state from database pool
            let server_state = server::create_app_state(db_connection.clone_pool());

            // Spawn HTTP server in background - MUST use tauri::async_runtime
            // Server runs independently of GUI and continues when window is hidden
            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::start_server(server_state).await {
                    eprintln!("HTTP server error: {}", e);
                }
            });

            app.manage(db_connection);

            // Create tray menu items
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Build tray icon with menu and event handlers
            // Note: Tray icon is optional - app continues if creation fails
            if let Some(icon) = app.default_window_icon() {
                match TrayIconBuilder::new()
                    .icon(icon.clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false) // Left click shows window, right click shows menu
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
                eprintln!("No default window icon available. App will continue without tray functionality.");
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
            commands::get_autostart_enabled,
            commands::set_autostart_enabled,
            commands::accounts::add_account,
            commands::accounts::get_accounts,
            commands::accounts::delete_account,
            commands::accounts::update_account
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
