// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(all(feature = "gui", not(debug_assertions)), windows_subsystem = "windows")]

use std::net::IpAddr;
use std::path::PathBuf;

use clap::Parser;
use streamforge_lib::headless::{run_headless, HeadlessConfig};

/// StreamForge — Xtream Codes to Plex bridge via HDHomeRun emulation.
///
/// Without flags: launches the desktop GUI application.
/// With --headless: runs as a server with web UI at http://localhost:5004/
#[derive(Parser, Debug)]
#[command(name = "streamforge", version, about)]
struct Cli {
    /// Run in headless mode (HTTP server + web UI, no desktop window).
    /// Access the web UI at http://<bind>:<port>/
    #[arg(long)]
    headless: bool,

    /// Start with window hidden (tray icon only, desktop mode)
    #[arg(long)]
    minimized: bool,

    /// HTTP server port [default: 5004]
    #[arg(long)]
    port: Option<u16>,

    /// Data directory for the SQLite database
    #[arg(long)]
    data_dir: Option<PathBuf>,

    /// Bind address for the HTTP server [default: 0.0.0.0]
    #[arg(long)]
    bind: Option<IpAddr>,

    /// Export configuration to a JSON file and exit
    #[arg(long, value_name = "PATH")]
    export_config: Option<PathBuf>,

    /// Import configuration from a JSON file and exit
    #[arg(long, value_name = "PATH")]
    import_config: Option<PathBuf>,
}

fn main() {
    let cli = Cli::parse();

    // Handle --export-config / --import-config (init DB, run operation, exit)
    if cli.export_config.is_some() || cli.import_config.is_some() {
        if let Err(e) = run_config_cli(&cli) {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
        return;
    }

    if cli.headless {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
        let config = HeadlessConfig {
            port: cli.port,
            data_dir: cli.data_dir,
            bind_address: cli.bind,
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
        eprintln!("StreamForge built without GUI support.");
        eprintln!("Use --headless to run as a server, or --help for all options.");
        std::process::exit(1);
    }
}

/// Handle --export-config and --import-config CLI flags.
///
/// Initialises the database (with migrations), runs the requested operation,
/// writes/reads the file, then returns so the process can exit.
fn run_config_cli(cli: &Cli) -> Result<(), Box<dyn std::error::Error>> {
    use streamforge_lib::commands::config::{
        export_configuration_standalone, import_configuration_standalone,
    };
    use streamforge_lib::db;

    let db_path = db::get_db_path_standalone(cli.data_dir.clone())?;
    let database_url = db_path.to_string_lossy().to_string();

    let mut conn = db::establish_connection(&database_url)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    db::run_migrations(&mut conn)
        .map_err(|e| format!("Failed to run migrations: {}", e))?;
    drop(conn);

    let db_connection = db::DbConnection::new(database_url)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    if let Some(path) = &cli.export_config {
        let json = export_configuration_standalone(&db_connection)?;
        std::fs::write(path, &json)
            .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;
        println!("Configuration exported to {}", path.display());
    }

    if let Some(path) = &cli.import_config {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
        let result = import_configuration_standalone(&db_connection, &content)?;
        println!("{}", result.message);
    }

    Ok(())
}
