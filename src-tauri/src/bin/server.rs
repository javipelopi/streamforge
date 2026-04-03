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
    #[arg(long)]
    export_config: Option<PathBuf>,

    /// Import configuration from a JSON file and exit
    #[arg(long)]
    import_config: Option<PathBuf>,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let config = HeadlessConfig {
        port: cli.port,
        data_dir: cli.data_dir,
        bind_address: cli.bind,
        export_config: cli.export_config,
        import_config: cli.import_config,
    };

    if let Err(e) = run_headless(config).await {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
