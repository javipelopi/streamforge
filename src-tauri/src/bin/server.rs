use std::net::IpAddr;
use std::path::PathBuf;

use clap::Parser;
use streamforge_lib::headless::{HeadlessConfig, run_headless};

/// StreamForge headless server — Xtream Codes to Plex bridge via HDHomeRun emulation.
#[derive(Parser, Debug)]
#[command(name = "streamforge-server", version, about)]
struct Cli {
    /// HTTP server port (default: value from DB settings, typically 5004)
    #[arg(long)]
    port: Option<u16>,

    /// Data directory for the SQLite database and related files
    #[arg(long)]
    data_dir: Option<PathBuf>,

    /// Bind address for the HTTP server (default: 0.0.0.0)
    #[arg(long)]
    bind: Option<IpAddr>,

    /// Export configuration to a JSON file and exit
    #[arg(long, value_name = "PATH")]
    export_config: Option<PathBuf>,

    /// Import configuration from a JSON file and exit
    #[arg(long, value_name = "PATH")]
    import_config: Option<PathBuf>,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    // Handle --export-config / --import-config (init DB, run operation, exit)
    if cli.export_config.is_some() || cli.import_config.is_some() {
        if let Err(e) = run_config_cli(&cli) {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
        return;
    }

    let config = HeadlessConfig {
        port: cli.port,
        data_dir: cli.data_dir,
        bind_address: cli.bind,
    };

    if let Err(e) = run_headless(config).await {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}

/// Handle --export-config and --import-config CLI flags.
fn run_config_cli(cli: &Cli) -> Result<(), Box<dyn std::error::Error>> {
    use streamforge_lib::services::config::{
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
