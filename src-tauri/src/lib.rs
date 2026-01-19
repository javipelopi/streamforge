pub mod commands;
pub mod db;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

// Constants
const MAIN_WINDOW_NAME: &str = "main";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
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
            commands::set_setting
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
