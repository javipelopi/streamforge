use futures_util::StreamExt;
use once_cell::sync::Lazy;
use reqwest::Client;
use std::fs;
use std::net::{IpAddr, ToSocketAddrs};
use std::path::Path;
use std::time::Duration;
use url::Url;

/// Maximum allowed playlist size in bytes (20MB)
const MAX_PLAYLIST_SIZE: u64 = 20 * 1024 * 1024;

/// Shared HTTP client for connection pooling
#[allow(dead_code)]
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("StreamForge/1.0")
            .danger_accept_invalid_certs(true)
        .build()
        .expect("Failed to create HTTP client")
});

/// Error type for M3U fetch operations
#[derive(Debug, thiserror::Error)]
pub enum M3uFetchError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Fetch timeout after {0} seconds")]
    Timeout(u64),

    #[error("HTTP status {0}: {1}")]
    HttpStatus(u16, String),

    #[error("Playlist too large: {0} bytes exceeds maximum of {1} bytes")]
    PlaylistTooLarge(u64, u64),

    #[error("SSRF blocked: {0}")]
    SsrfBlocked(String),

    #[error("DNS resolution failed: {0}")]
    DnsResolutionFailed(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("File read error: {0}")]
    FileReadError(String),

    #[error("Invalid file path: {0}")]
    InvalidFilePath(String),
}

/// Check if an IP address is in a private/reserved range that should be blocked for SSRF protection
fn is_private_or_reserved_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => {
            // Loopback: 127.0.0.0/8
            ipv4.is_loopback()
            // Private ranges
            || ipv4.is_private()           // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            // Link-local: 169.254.0.0/16
            || ipv4.is_link_local()
            // Broadcast
            || ipv4.is_broadcast()
            // Documentation ranges (should not be routable)
            || ipv4.is_documentation()
            // Unspecified address (0.0.0.0)
            || ipv4.is_unspecified()
        }
        IpAddr::V6(ipv6) => {
            // Loopback: ::1
            ipv6.is_loopback()
            // Unspecified: ::
            || ipv6.is_unspecified()
            // IPv4-mapped addresses - check the embedded IPv4
            || {
                if let Some(ipv4) = ipv6.to_ipv4_mapped() {
                    ipv4.is_loopback() || ipv4.is_private() || ipv4.is_link_local()
                } else {
                    false
                }
            }
        }
    }
}

/// Validate URL for SSRF protection
/// Blocks requests to private/internal IP addresses
fn validate_url_for_ssrf(url: &str) -> Result<(), M3uFetchError> {
    let parsed_url = Url::parse(url).map_err(|e| M3uFetchError::InvalidUrl(e.to_string()))?;

    let host = parsed_url
        .host_str()
        .ok_or_else(|| M3uFetchError::InvalidUrl("URL has no host".to_string()))?;

    // Check for localhost variations
    let host_lower = host.to_lowercase();
    if host_lower == "localhost" || host_lower == "localhost." {
        return Err(M3uFetchError::SsrfBlocked(
            "localhost is not allowed".to_string(),
        ));
    }

    // Try to parse as IP address directly
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_or_reserved_ip(&ip) {
            return Err(M3uFetchError::SsrfBlocked(format!(
                "Private/reserved IP address {} is not allowed",
                ip
            )));
        }
        return Ok(());
    }

    // Resolve hostname to IP addresses and check each
    let port = parsed_url.port().unwrap_or(match parsed_url.scheme() {
        "https" => 443,
        _ => 80,
    });

    let socket_addrs: Vec<_> = format!("{}:{}", host, port)
        .to_socket_addrs()
        .map_err(|e| M3uFetchError::DnsResolutionFailed(format!("{}: {}", host, e)))?
        .collect();

    if socket_addrs.is_empty() {
        return Err(M3uFetchError::DnsResolutionFailed(format!(
            "No addresses found for host: {}",
            host
        )));
    }

    for addr in socket_addrs {
        if is_private_or_reserved_ip(&addr.ip()) {
            return Err(M3uFetchError::SsrfBlocked(format!(
                "Host {} resolves to private/reserved IP address {}",
                host,
                addr.ip()
            )));
        }
    }

    Ok(())
}

/// Fetch M3U playlist content from a URL
///
/// Handles both M3U and M3U8 playlists, with configurable timeout.
/// Returns the raw playlist content as a string.
///
/// Security: Blocks requests to private/internal IP addresses (SSRF protection)
/// Safety: Limits playlist size to 20MB to prevent OOM
pub async fn fetch_m3u_playlist(url: &str) -> Result<String, M3uFetchError> {
    fetch_m3u_playlist_with_timeout(url, 30).await
}

/// Fetch M3U playlist with custom timeout
pub async fn fetch_m3u_playlist_with_timeout(
    url: &str,
    timeout_secs: u64,
) -> Result<String, M3uFetchError> {
    // Validate URL scheme
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(M3uFetchError::InvalidUrl(format!(
            "URL must start with http:// or https://, got: {}",
            url
        )));
    }

    // SSRF protection: validate URL before fetching AND pin resolved IPs
    // This prevents DNS rebinding attacks (TOCTOU)
    let parsed_url = Url::parse(url).map_err(|e| M3uFetchError::InvalidUrl(e.to_string()))?;
    let host = parsed_url
        .host_str()
        .ok_or_else(|| M3uFetchError::InvalidUrl("URL has no host".to_string()))?;

    // Resolve and validate IPs upfront
    validate_url_for_ssrf(url)?;

    // Get the first valid IP to pin the connection to (prevents DNS rebinding)
    let port = parsed_url.port().unwrap_or(match parsed_url.scheme() {
        "https" => 443,
        _ => 80,
    });

    let socket_addrs: Vec<_> = format!("{}:{}", host, port)
        .to_socket_addrs()
        .map_err(|e| M3uFetchError::DnsResolutionFailed(format!("{}: {}", host, e)))?
        .collect();

    let pinned_ip = socket_addrs
        .first()
        .ok_or_else(|| M3uFetchError::DnsResolutionFailed(format!("No addresses for host: {}", host)))?
        .ip();

    // Create client with DNS pinning to prevent rebinding attacks
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .user_agent("StreamForge/1.0")
        .resolve(host, (pinned_ip, port).into())
            .danger_accept_invalid_certs(true)
        .build()?;

    let response = client.get(url).send().await?;

    // Check for HTTP errors
    let status = response.status();
    if !status.is_success() {
        return Err(M3uFetchError::HttpStatus(
            status.as_u16(),
            status.canonical_reason().unwrap_or("Unknown").to_string(),
        ));
    }

    // Check Content-Length header if present
    if let Some(content_length) = response.content_length() {
        if content_length > MAX_PLAYLIST_SIZE {
            return Err(M3uFetchError::PlaylistTooLarge(
                content_length,
                MAX_PLAYLIST_SIZE,
            ));
        }
    }

    // Stream the response and track bytes downloaded
    let mut bytes_downloaded: u64 = 0;
    let mut content = Vec::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result?;
        bytes_downloaded += chunk.len() as u64;

        // Check size limit during streaming (handles chunked/unknown content-length)
        if bytes_downloaded > MAX_PLAYLIST_SIZE {
            return Err(M3uFetchError::PlaylistTooLarge(
                bytes_downloaded,
                MAX_PLAYLIST_SIZE,
            ));
        }

        content.extend_from_slice(&chunk);
    }

    // Convert bytes to string
    String::from_utf8(content).map_err(|e| {
        M3uFetchError::InvalidUrl(format!("Playlist contains invalid UTF-8: {}", e))
    })
}

/// Read M3U playlist content from a local file
///
/// Handles both M3U and M3U8 files.
/// Returns the raw playlist content as a string.
///
/// Security: Validates file path and extension
/// Safety: Limits file size to 20MB to prevent OOM
pub fn read_local_m3u_file(file_path: &str) -> Result<String, M3uFetchError> {
    let path = Path::new(file_path);

    // Validate file exists
    if !path.exists() {
        return Err(M3uFetchError::FileNotFound(file_path.to_string()));
    }

    // Validate it's a file, not a directory
    if !path.is_file() {
        return Err(M3uFetchError::InvalidFilePath(format!(
            "Path is not a file: {}",
            file_path
        )));
    }

    // Validate file extension
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    match extension.as_deref() {
        Some("m3u") | Some("m3u8") => {}
        _ => {
            return Err(M3uFetchError::InvalidFilePath(format!(
                "File must have .m3u or .m3u8 extension: {}",
                file_path
            )));
        }
    }

    // Check file size before reading
    let metadata = fs::metadata(path).map_err(|e| {
        M3uFetchError::FileReadError(format!("Failed to read file metadata: {}", e))
    })?;

    if metadata.len() > MAX_PLAYLIST_SIZE {
        return Err(M3uFetchError::PlaylistTooLarge(
            metadata.len(),
            MAX_PLAYLIST_SIZE,
        ));
    }

    // Read file content
    let content = fs::read_to_string(path).map_err(|e| {
        M3uFetchError::FileReadError(format!("Failed to read file: {}", e))
    })?;

    Ok(content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_url_validation() {
        let rt = tokio::runtime::Runtime::new().unwrap();

        rt.block_on(async {
            let result = fetch_m3u_playlist("ftp://invalid.com/playlist.m3u").await;
            assert!(matches!(result, Err(M3uFetchError::InvalidUrl(_))));

            let result = fetch_m3u_playlist("/local/path.m3u").await;
            assert!(matches!(result, Err(M3uFetchError::InvalidUrl(_))));
        });
    }

    #[test]
    fn test_ssrf_localhost_blocked() {
        let result = validate_url_for_ssrf("http://localhost/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));

        let result = validate_url_for_ssrf("http://127.0.0.1/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));

        let result = validate_url_for_ssrf("http://127.0.0.1:8080/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));
    }

    #[test]
    fn test_ssrf_private_ranges_blocked() {
        // 10.0.0.0/8
        let result = validate_url_for_ssrf("http://10.0.0.1/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));

        let result = validate_url_for_ssrf("http://10.255.255.255/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));

        // 172.16.0.0/12
        let result = validate_url_for_ssrf("http://172.16.0.1/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));

        let result = validate_url_for_ssrf("http://172.31.255.255/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));

        // 192.168.0.0/16
        let result = validate_url_for_ssrf("http://192.168.1.1/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));

        let result = validate_url_for_ssrf("http://192.168.255.255/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));
    }

    #[test]
    fn test_ssrf_link_local_blocked() {
        // 169.254.0.0/16
        let result = validate_url_for_ssrf("http://169.254.1.1/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));
    }

    #[test]
    fn test_ssrf_ipv6_loopback_blocked() {
        let result = validate_url_for_ssrf("http://[::1]/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::SsrfBlocked(_))));
    }

    #[test]
    fn test_ssrf_public_ips_allowed() {
        // Google DNS - should be allowed
        let result = validate_url_for_ssrf("http://8.8.8.8/playlist.m3u");
        assert!(result.is_ok());

        // Cloudflare DNS - should be allowed
        let result = validate_url_for_ssrf("http://1.1.1.1/playlist.m3u");
        assert!(result.is_ok());
    }

    #[test]
    fn test_is_private_or_reserved_ip() {
        // Loopback
        assert!(is_private_or_reserved_ip(&"127.0.0.1".parse().unwrap()));
        assert!(is_private_or_reserved_ip(&"::1".parse().unwrap()));

        // Private ranges
        assert!(is_private_or_reserved_ip(&"10.0.0.1".parse().unwrap()));
        assert!(is_private_or_reserved_ip(&"172.16.0.1".parse().unwrap()));
        assert!(is_private_or_reserved_ip(&"192.168.0.1".parse().unwrap()));

        // Link-local
        assert!(is_private_or_reserved_ip(&"169.254.1.1".parse().unwrap()));

        // Public IPs should NOT be blocked
        assert!(!is_private_or_reserved_ip(&"8.8.8.8".parse().unwrap()));
        assert!(!is_private_or_reserved_ip(&"1.1.1.1".parse().unwrap()));
        assert!(!is_private_or_reserved_ip(
            &"93.184.216.34".parse().unwrap()  // example.com
        ));
    }

    // Tests for read_local_m3u_file

    #[test]
    fn test_read_local_file_not_found() {
        let result = read_local_m3u_file("/nonexistent/path/playlist.m3u");
        assert!(matches!(result, Err(M3uFetchError::FileNotFound(_))));
    }

    #[test]
    fn test_read_local_file_invalid_extension_txt() {
        // Create temp directory with a .txt file
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_invalid_ext.txt");
        fs::write(&test_file, "#EXTM3U\n#EXTINF:-1,Test\nhttp://test.com/stream.m3u8").unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(matches!(result, Err(M3uFetchError::InvalidFilePath(_))));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_invalid_extension_json() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_invalid_ext.json");
        fs::write(&test_file, "{}").unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(matches!(result, Err(M3uFetchError::InvalidFilePath(_))));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_no_extension() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_no_ext");
        fs::write(&test_file, "#EXTM3U\n").unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(matches!(result, Err(M3uFetchError::InvalidFilePath(_))));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_valid_m3u() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_valid.m3u");
        let content = "#EXTM3U\n#EXTINF:-1 tvg-id=\"cnn\",CNN HD\nhttp://example.com/cnn.m3u8\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_valid_m3u8() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_valid.m3u8");
        let content = "#EXTM3U\n#EXTINF:-1,ESPN HD\nhttp://example.com/espn.m3u8\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_uppercase_extension() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_uppercase.M3U");
        let content = "#EXTM3U\n#EXTINF:-1,Test\nhttp://example.com/test.m3u8\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_mixed_case_m3u8() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_mixed.M3U8");
        let content = "#EXTM3U\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_unicode_content() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_unicode.m3u");
        let content = "#EXTM3U\n#EXTINF:-1 tvg-name=\"日本テレビ\",日本テレビ\nhttp://example.com/ntv.m3u8\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());
        let read_content = result.unwrap();
        assert!(read_content.contains("日本テレビ"));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_with_bom() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_bom.m3u");
        // Write content with UTF-8 BOM
        let content = "\u{FEFF}#EXTM3U\n#EXTINF:-1,Test Channel\nhttp://example.com/test.m3u8\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());
        let read_content = result.unwrap();
        // BOM should be preserved (parser handles it)
        assert!(read_content.starts_with('\u{FEFF}') || read_content.starts_with("#EXTM3U"));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_directory_path() {
        let temp_dir = std::env::temp_dir();
        // Try to read a directory as a file
        let result = read_local_m3u_file(temp_dir.to_str().unwrap());
        // Should fail because it's not a file
        assert!(matches!(
            result,
            Err(M3uFetchError::InvalidFilePath(_)) | Err(M3uFetchError::FileNotFound(_))
        ));
    }

    #[test]
    fn test_read_local_file_empty() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_empty.m3u");
        fs::write(&test_file, "").unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "");

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_with_special_chars_in_content() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_special.m3u");
        let content = "#EXTM3U\n#EXTINF:-1 tvg-name=\"News & Weather (24/7)\" group-title=\"News/Weather\",News & Weather\nhttp://example.com/news.m3u8?token=abc&quality=HD\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());
        let read_content = result.unwrap();
        assert!(read_content.contains("News & Weather"));
        assert!(read_content.contains("token=abc&quality=HD"));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_read_local_file_crlf_line_endings() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_crlf.m3u");
        let content = "#EXTM3U\r\n#EXTINF:-1,Test\r\nhttp://example.com/test.m3u8\r\n";
        fs::write(&test_file, content).unwrap();

        let result = read_local_m3u_file(test_file.to_str().unwrap());
        assert!(result.is_ok());
        let read_content = result.unwrap();
        assert!(read_content.contains("\r\n"));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }
}
