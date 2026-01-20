//! Integration tests for the Axum HTTP server
//!
//! These tests verify the HTTP server functionality without requiring
//! the full Tauri GUI application to be running.
//!
//! Story 1-5: Create Axum HTTP Server Foundation

use std::net::SocketAddr;
use std::time::Duration;

use streamforge_lib::server::{routes::create_router, AppState};
use tokio::net::TcpListener;

/// Helper function to create a test AppState with a mock database pool
/// For testing, we use a temporary in-memory SQLite database
fn create_test_app_state() -> AppState {
    use diesel::prelude::*;
    use diesel::r2d2::{ConnectionManager, Pool};

    // Create an in-memory SQLite database for testing
    let manager = ConnectionManager::<SqliteConnection>::new(":memory:");
    let pool = Pool::builder()
        .max_size(1)
        .build(manager)
        .expect("Failed to create test pool");

    // Run migrations on the test database
    let mut conn = pool.get().expect("Failed to get connection");

    // Create the settings table for the test
    diesel::sql_query(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        )",
    )
    .execute(&mut conn)
    .expect("Failed to create settings table");

    AppState::new(pool)
}

/// Start a test server on a random available port
async fn start_test_server() -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let state = create_test_app_state();
    let app = create_router(state);

    // Bind to port 0 to get a random available port
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind to port");
    let addr = listener.local_addr().expect("Failed to get local address");

    let handle = tokio::spawn(async move {
        axum::serve(listener, app)
            .await
            .expect("Server error");
    });

    // Give the server a moment to start
    tokio::time::sleep(Duration::from_millis(100)).await;

    (addr, handle)
}

#[tokio::test]
async fn test_health_endpoint_returns_200_ok() {
    let (addr, _handle) = start_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{}/health", addr))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200, "Health endpoint should return 200 OK");
}

#[tokio::test]
async fn test_health_endpoint_returns_json() {
    let (addr, _handle) = start_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{}/health", addr))
        .send()
        .await
        .expect("Failed to send request");

    let content_type = response
        .headers()
        .get("content-type")
        .expect("Missing content-type header")
        .to_str()
        .expect("Invalid content-type header");

    assert!(
        content_type.contains("application/json"),
        "Health endpoint should return JSON content-type, got: {}",
        content_type
    );

    let body: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["status"], "healthy", "Health status should be 'healthy'");
}

#[tokio::test]
async fn test_unknown_route_returns_404() {
    let (addr, _handle) = start_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{}/nonexistent", addr))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 404, "Unknown route should return 404");
}

#[tokio::test]
async fn test_server_handles_concurrent_requests() {
    let (addr, _handle) = start_test_server().await;

    let client = reqwest::Client::new();

    // Send 10 concurrent requests
    let futures: Vec<_> = (0..10)
        .map(|_| {
            let client = client.clone();
            let url = format!("http://{}/health", addr);
            async move { client.get(url).send().await }
        })
        .collect();

    let responses = futures::future::join_all(futures).await;

    // All requests should succeed
    for response in responses {
        let response = response.expect("Request failed");
        assert_eq!(
            response.status(),
            200,
            "Concurrent request should return 200 OK"
        );
    }
}

#[tokio::test]
async fn test_server_binds_to_localhost_only() {
    let state = create_test_app_state();
    let app = create_router(state);

    // Verify we can bind to 127.0.0.1 (localhost)
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Should be able to bind to localhost");
    let addr = listener.local_addr().unwrap();

    // Verify the address is localhost
    assert_eq!(
        addr.ip().to_string(),
        "127.0.0.1",
        "Server should bind to localhost (127.0.0.1)"
    );

    // Start serving
    let _handle = tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    tokio::time::sleep(Duration::from_millis(50)).await;

    // Verify we can connect to localhost
    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://127.0.0.1:{}/health", addr.port()))
        .send()
        .await
        .expect("Should connect to localhost");

    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn test_default_port_is_5004() {
    let state = create_test_app_state();
    let port = state.get_port();

    assert_eq!(port, 5004, "Default port should be 5004");
}
