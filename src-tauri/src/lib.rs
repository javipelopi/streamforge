pub mod commands;
pub mod db;

use tauri::Manager;

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
