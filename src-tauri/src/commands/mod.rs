use diesel::prelude::*;
use tauri::State;

use crate::db::{schema::settings, DbConnection, Setting};

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to iptv.", name)
}

#[tauri::command]
pub fn get_setting(db: State<DbConnection>, key: String) -> Result<Option<String>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let result = settings::table
        .filter(settings::key.eq(&key))
        .select(settings::value)
        .first::<String>(&mut conn)
        .optional()
        .map_err(|e| format!("Query error: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub fn set_setting(db: State<DbConnection>, key: String, value: String) -> Result<(), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let setting = Setting::new(key, value);

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(&mut conn)
        .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}
