use axum::http::{header, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "../dist"]
struct Asset;

/// Serve embedded static files from the Vite build output.
///
/// For `/` and any path not matching an embedded file, serves `index.html`
/// (SPA fallback). Returns proper Content-Type based on file extension.
pub async fn static_handler(uri: axum::http::Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    // Try the exact path first, then fall back to index.html (SPA routing)
    if !path.is_empty() {
        if let Some(file) = Asset::get(path) {
            return serve_file(path, &file.data);
        }
    }

    // SPA fallback: serve index.html
    match Asset::get("index.html") {
        Some(file) => Html(String::from_utf8_lossy(&file.data).to_string()).into_response(),
        None => (StatusCode::NOT_FOUND, "index.html not found in embedded assets").into_response(),
    }
}

fn serve_file(path: &str, data: &[u8]) -> Response {
    let content_type = mime_guess::from_path(path)
        .first_raw()
        .unwrap_or("application/octet-stream");

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, content_type)],
        data.to_vec(),
    )
        .into_response()
}
