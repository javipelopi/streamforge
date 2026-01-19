// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;

use tauri::Manager;

fn main() {
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

            // Store connection for later use by commands
            app.manage(db::DbConnection::new(database_url));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_setting,
            commands::set_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
