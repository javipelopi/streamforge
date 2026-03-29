//! Headless entry point for running StreamForge without a GUI.
//!
//! Provides `run_headless()` which initialises the database, runs migrations,
//! spawns the HTTP server and EPG scheduler, and waits for a shutdown signal
//! (Ctrl-C). This is the foundation for the standalone `streamforge-server`
//! CLI binary.

use std::net::IpAddr;
use std::path::PathBuf;

use crate::db;
use crate::scheduler;
use crate::server;

/// Configuration for headless (no-GUI) operation.
#[derive(Debug, Clone)]
pub struct HeadlessConfig {
    /// Override the HTTP server port. `None` uses the DB-stored setting (default 5004).
    pub port: Option<u16>,
    /// Explicit data directory. `None` falls back to `dirs::data_dir()/streamforge`.
    pub data_dir: Option<PathBuf>,
    /// Bind address for the HTTP server. Defaults to `0.0.0.0`.
    pub bind_address: Option<IpAddr>,
}

impl Default for HeadlessConfig {
    fn default() -> Self {
        Self {
            port: None,
            data_dir: None,
            bind_address: None,
        }
    }
}

/// Run StreamForge in headless mode.
///
/// 1. Resolves the database path (standalone, no Tauri).
/// 2. Runs pending migrations.
/// 3. Creates a connection pool.
/// 4. Spawns the HTTP server.
/// 5. Spawns the EPG scheduler.
/// 6. Awaits `SIGINT` / Ctrl-C for graceful shutdown.
pub async fn run_headless(config: HeadlessConfig) -> Result<(), Box<dyn std::error::Error>> {
    // --- Database -----------------------------------------------------------
    let db_path = db::get_db_path_standalone(config.data_dir.clone())?;
    let database_url = db_path.to_string_lossy().to_string();

    let mut conn = db::establish_connection(&database_url)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    db::run_migrations(&mut conn)
        .map_err(|e| format!("Failed to run migrations: {}", e))?;
    drop(conn); // release single connection; pool takes over

    let db_connection = db::DbConnection::new(database_url)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    // --- App data dir (for credential retrieval) ----------------------------
    let app_data_dir = config
        .data_dir
        .clone()
        .unwrap_or_else(|| {
            dirs::data_dir()
                .map(|d| d.join("streamforge"))
                .unwrap_or_else(|| PathBuf::from("."))
        });

    // --- HTTP server --------------------------------------------------------
    let pool = db_connection.clone_pool();
    let server_state = server::create_app_state_with_dir(pool, app_data_dir);

    // Apply port / bind overrides
    let port = config.port.unwrap_or_else(|| server_state.get_port());
    let bind_addr: IpAddr = config.bind_address.unwrap_or_else(|| [0, 0, 0, 0].into());
    let addr = std::net::SocketAddr::new(bind_addr, port);

    let server_handle = tokio::spawn(async move {
        let app = server::routes::create_router(server_state);
        let listener = tokio::net::TcpListener::bind(addr).await?;
        println!("HTTP server listening on http://{}", addr);
        axum::serve(listener, app).await.map_err(|e| {
            Box::<dyn std::error::Error + Send + Sync>::from(e.to_string())
        })
    });

    // --- EPG scheduler ------------------------------------------------------
    let scheduler_pool = db_connection.clone_pool();
    let epg_scheduler = scheduler::EpgScheduler::new();

    let sched = epg_scheduler.clone();
    tokio::spawn(async move {
        sched.set_db_pool(scheduler_pool).await;

        if let Err(e) = sched.start().await {
            eprintln!("Failed to start EPG scheduler: {}", e);
            return;
        }
        println!("EPG scheduler started");

        if let Some(mut conn) = sched.get_db_connection().await {
            let schedule = scheduler::get_epg_schedule(&mut conn);

            if let Err(e) = sched.set_enabled(schedule.enabled).await {
                eprintln!("Failed to set scheduler enabled state: {}", e);
            }

            if schedule.enabled {
                if let Err(e) = sched.update_schedule(schedule.hour, schedule.minute).await {
                    eprintln!("Failed to update EPG schedule: {}", e);
                } else {
                    println!(
                        "EPG scheduler configured: refresh at {:02}:{:02} daily",
                        schedule.hour, schedule.minute
                    );
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(7)).await;
            scheduler::check_and_trigger_missed_refresh(&sched).await;
        }
    });

    // --- Shutdown -----------------------------------------------------------
    println!("StreamForge headless mode running. Press Ctrl-C to stop.");
    tokio::signal::ctrl_c().await?;
    println!("Shutting down...");

    server_handle.abort();
    Ok(())
}
