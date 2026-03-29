// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(all(feature = "gui", not(debug_assertions)), windows_subsystem = "windows")]

fn main() {
    #[cfg(feature = "gui")]
    streamforge_lib::run();

    #[cfg(not(feature = "gui"))]
    {
        // Headless mode placeholder — will be implemented in ip-1dm
        eprintln!("StreamForge built without GUI. Use --help for CLI options.");
    }
}
