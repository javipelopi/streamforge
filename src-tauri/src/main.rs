// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(all(feature = "gui", not(debug_assertions)), windows_subsystem = "windows")]

use std::path::PathBuf;
use streamforge_lib::headless::{run_headless, HeadlessConfig};

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|a| a == "--headless") {
        let export_config = args.windows(2)
            .find(|w| w[0] == "--export-config")
            .map(|w| PathBuf::from(&w[1]));
        let import_config = args.windows(2)
            .find(|w| w[0] == "--import-config")
            .map(|w| PathBuf::from(&w[1]));

        let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
        let config = HeadlessConfig {
            export_config,
            import_config,
            ..HeadlessConfig::default()
        };
        if let Err(e) = rt.block_on(run_headless(config)) {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
        return;
    }

    #[cfg(feature = "gui")]
    streamforge_lib::run();

    #[cfg(not(feature = "gui"))]
    {
        eprintln!("StreamForge built without GUI. Use --headless for server mode.");
        eprintln!("  --export-config <path>  Export configuration to JSON file");
        eprintln!("  --import-config <path>  Import configuration from JSON file");
    }
}
