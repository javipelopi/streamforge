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
}

fn main() {
    let cli = Cli::parse();

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
