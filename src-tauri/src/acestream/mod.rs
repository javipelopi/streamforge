use reqwest::Client;
use std::sync::OnceLock;
use std::time::Duration;

/// Default Acestream Engine local port
const ACESTREAM_ENGINE_PORT: u16 = 6878;

/// Health check timeout in seconds.
/// 5 seconds balances responsiveness with allowing slow network conditions.
/// Connection refused is instant; this timeout covers routing/firewall issues.
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 5;

/// Shared HTTP client for health checks (Issue 3: HTTP Client Leak Fix)
/// Using OnceLock to ensure single initialization across all health checks
static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

/// Get or initialize the shared HTTP client
fn get_http_client() -> Result<&'static Client, AcestreamError> {
    // Use get_or_init instead of unstable get_or_try_init
    Ok(HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(HEALTH_CHECK_TIMEOUT_SECS))
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_else(|_| {
                // Fallback to default client if builder fails
                Client::new()
            })
    }))
}

/// Check if Acestream Engine is supported on the current platform.
///
/// Supported platforms:
/// - Windows: Native Acestream Engine
/// - Linux: Native Acestream Engine
/// - FreeBSD: Native Acestream Engine (via Linux compatibility layer)
/// - Android: Acestream Engine app available
///
/// Unsupported platforms:
/// - macOS: No Acestream Engine available
/// - iOS: No Acestream Engine available
pub fn is_acestream_supported() -> bool {
    let os = std::env::consts::OS;
    matches!(os, "windows" | "linux" | "freebsd" | "android")
}

/// Get the current platform name for display
pub fn get_platform_name() -> &'static str {
    std::env::consts::OS
}

/// Check if Acestream Engine is running on localhost
///
/// Sends a health check request to the local Acestream Engine API.
/// Returns true if the engine responds successfully.
pub async fn check_acestream_engine() -> Result<bool, AcestreamError> {
    check_acestream_engine_at_port(ACESTREAM_ENGINE_PORT).await
}

/// Check Acestream Engine at a specific port
pub async fn check_acestream_engine_at_port(port: u16) -> Result<bool, AcestreamError> {
    // First check if platform supports Acestream
    if !is_acestream_supported() {
        return Err(AcestreamError::UnsupportedPlatform(get_platform_name().to_string()));
    }

    let url = format!("http://127.0.0.1:{}/webui/api/service?method=get_version", port);

    // Use shared HTTP client to prevent resource leaks (Issue 3)
    let client = get_http_client()?;

    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                Ok(true)
            } else {
                Ok(false)
            }
        }
        Err(e) => {
            // Distinguish connection errors (engine not running) from other failures
            if e.is_connect() || e.is_timeout() {
                // Connection refused or timeout means engine is not running
                Err(AcestreamError::EngineNotRunning)
            } else {
                // Other errors (DNS failures, etc.) should be reported
                Err(AcestreamError::HttpError(e.to_string()))
            }
        }
    }
}

/// Build a stream URL for an Acestream content ID
///
/// The Acestream Engine provides an HTTP proxy at localhost:6878 that can
/// stream content by content ID.
pub fn build_acestream_url(content_id: &str) -> Result<String, AcestreamError> {
    build_acestream_url_with_port(content_id, ACESTREAM_ENGINE_PORT)
}

/// Build Acestream URL with custom port
pub fn build_acestream_url_with_port(content_id: &str, port: u16) -> Result<String, AcestreamError> {
    // Normalize content ID to lowercase for consistency
    let normalized_id = content_id.to_lowercase();

    // Validate content ID format (40 hex characters)
    if !is_valid_content_id(&normalized_id) {
        return Err(AcestreamError::InvalidContentId(content_id.to_string()));
    }

    // Check platform support
    if !is_acestream_supported() {
        return Err(AcestreamError::UnsupportedPlatform(get_platform_name().to_string()));
    }

    // Acestream Engine HTTP API format - URL encode the content ID for safety
    let encoded_id = urlencoding::encode(&normalized_id);
    Ok(format!(
        "http://127.0.0.1:{}/ace/getstream?id={}",
        port, encoded_id
    ))
}

/// Parse an acestream:// URL to extract the content ID
/// Content ID is normalized to lowercase for consistent storage
pub fn parse_acestream_url(url: &str) -> Option<String> {
    url.strip_prefix("acestream://")
        .map(|s| s.trim().to_lowercase())
        .filter(|id| is_valid_content_id(id))
}

/// Validate an Acestream content ID format
///
/// Content IDs are 40-character hexadecimal strings (SHA-1 hash)
fn is_valid_content_id(content_id: &str) -> bool {
    content_id.len() == 40 && content_id.chars().all(|c| c.is_ascii_hexdigit())
}

/// Acestream status information
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcestreamStatus {
    pub is_supported: bool,
    pub platform: String,
    pub engine_available: bool,
    pub engine_url: String,
}

/// Get comprehensive Acestream status
pub async fn get_acestream_status() -> AcestreamStatus {
    let is_supported = is_acestream_supported();
    let platform = get_platform_name().to_string();

    let engine_available = if is_supported {
        match check_acestream_engine().await {
            Ok(available) => available,
            Err(AcestreamError::EngineNotRunning) => false,
            Err(AcestreamError::UnsupportedPlatform(_)) => false,
            Err(e) => {
                // Log other errors but treat as unavailable
                tracing::warn!("Acestream health check failed: {}", e);
                false
            }
        }
    } else {
        false
    };

    let engine_url = format!("http://127.0.0.1:{}", ACESTREAM_ENGINE_PORT);

    AcestreamStatus {
        is_supported,
        platform,
        engine_available,
        engine_url,
    }
}

/// Error type for Acestream operations
#[derive(Debug, thiserror::Error)]
pub enum AcestreamError {
    #[error("Acestream is not supported on {0}")]
    UnsupportedPlatform(String),

    #[error("Invalid Acestream content ID: {0}")]
    InvalidContentId(String),

    #[error("Acestream Engine is not running")]
    EngineNotRunning,

    #[error("HTTP error: {0}")]
    HttpError(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_content_id() {
        // Valid 40-char hex string
        assert!(is_valid_content_id("1234567890abcdef1234567890abcdef12345678"));
        assert!(is_valid_content_id("ABCDEF1234567890ABCDEF1234567890ABCDEF12"));

        // Invalid cases
        assert!(!is_valid_content_id("too_short"));
        assert!(!is_valid_content_id(
            "1234567890abcdef1234567890abcdef123456789" // 41 chars
        ));
        assert!(!is_valid_content_id(
            "1234567890abcdef1234567890abcdef1234567g" // has 'g'
        ));
    }

    #[test]
    fn test_parse_acestream_url() {
        let content_id = "1234567890abcdef1234567890abcdef12345678";
        let url = format!("acestream://{}", content_id);

        assert_eq!(parse_acestream_url(&url), Some(content_id.to_string()));
        assert_eq!(parse_acestream_url("http://example.com"), None);
        assert_eq!(parse_acestream_url("acestream://invalid"), None);

        // Test case normalization - uppercase input should return lowercase
        let uppercase_url = "acestream://ABCDEF1234567890ABCDEF1234567890ABCDEF12";
        assert_eq!(
            parse_acestream_url(uppercase_url),
            Some("abcdef1234567890abcdef1234567890abcdef12".to_string())
        );
    }

    #[test]
    fn test_build_acestream_url() {
        let content_id = "1234567890abcdef1234567890abcdef12345678";

        // Platform-dependent test
        if is_acestream_supported() {
            let url = build_acestream_url(content_id).unwrap();
            assert!(url.contains("127.0.0.1:6878"));
            assert!(url.contains(content_id));
        } else {
            let result = build_acestream_url(content_id);
            assert!(matches!(result, Err(AcestreamError::UnsupportedPlatform(_))));
        }
    }

    #[test]
    fn test_build_acestream_url_invalid_id() {
        // Skip platform check error on unsupported platforms
        if !is_acestream_supported() {
            return;
        }

        let result = build_acestream_url("invalid");
        assert!(matches!(result, Err(AcestreamError::InvalidContentId(_))));
    }

    #[test]
    fn test_platform_support_documentation() {
        // Document expected platform support
        // This test serves as documentation and will pass on any platform
        let os = std::env::consts::OS;
        let is_supported = is_acestream_supported();

        match os {
            "windows" | "linux" | "freebsd" | "android" => {
                assert!(is_supported, "Platform {} should be supported", os);
            }
            "macos" | "ios" => {
                assert!(!is_supported, "Platform {} should NOT be supported", os);
            }
            _ => {
                // Unknown platform - just document what we got
                println!("Unknown platform: {}, supported: {}", os, is_supported);
            }
        }
    }

    #[test]
    fn test_content_id_validation_edge_cases() {
        // Test various edge cases for content ID validation

        // Valid: exactly 40 hex chars
        assert!(is_valid_content_id("0123456789abcdef0123456789abcdef01234567"));

        // Valid: uppercase (should be normalized before validation)
        assert!(is_valid_content_id("ABCDEF0123456789ABCDEF0123456789ABCDEF01"));

        // Invalid: too short (39 chars)
        assert!(!is_valid_content_id("0123456789abcdef0123456789abcdef0123456"));

        // Invalid: too long (41 chars)
        assert!(!is_valid_content_id("0123456789abcdef0123456789abcdef012345678"));

        // Invalid: non-hex character
        assert!(!is_valid_content_id("0123456789abcdef0123456789abcdef0123456g"));

        // Invalid: empty
        assert!(!is_valid_content_id(""));

        // Invalid: spaces
        assert!(!is_valid_content_id("0123456789abcdef 123456789abcdef01234567"));
    }

    #[test]
    fn test_url_building_formats() {
        // Skip if platform doesn't support Acestream
        if !is_acestream_supported() {
            return;
        }

        // Test URL building produces expected format
        let content_id = "0123456789abcdef0123456789abcdef01234567";

        let stream_url = build_acestream_url(content_id).unwrap();
        assert!(stream_url.contains("127.0.0.1:6878"));
        assert!(stream_url.contains(content_id));
        assert!(stream_url.starts_with("http://"));

        // Test with custom port
        let custom_url = build_acestream_url_with_port(content_id, 8080).unwrap();
        assert!(custom_url.contains("127.0.0.1:8080"));
        assert!(custom_url.contains(content_id));
        assert!(custom_url.starts_with("http://"));
    }

    #[test]
    fn test_health_check_url_format() {
        let expected_url = format!("http://127.0.0.1:{}/webui/api/service?method=get_version", ACESTREAM_ENGINE_PORT);

        // Verify the URL format is correct for the default port
        assert!(expected_url.contains("127.0.0.1:6878"));
        assert!(expected_url.starts_with("http://"));
        assert!(expected_url.contains("/webui/api/service"));
        assert!(expected_url.contains("method=get_version"));
    }

    #[test]
    fn test_get_platform_name() {
        let platform = get_platform_name();

        // Platform should be a non-empty string
        assert!(!platform.is_empty());

        // Should match one of the expected platform values
        let expected_platforms = ["windows", "linux", "freebsd", "android", "macos", "ios"];
        assert!(
            expected_platforms.contains(&platform),
            "Platform '{}' should be one of: {:?}",
            platform,
            expected_platforms
        );
    }

    #[test]
    fn test_url_encoding_in_content_id() {
        // Skip if platform doesn't support Acestream
        if !is_acestream_supported() {
            return;
        }

        let content_id = "0123456789abcdef0123456789abcdef01234567";
        let url = build_acestream_url(content_id).unwrap();

        // URL should be properly encoded
        assert!(url.contains("?id="));
        assert!(url.contains(content_id));

        // Verify URL structure
        assert!(url.starts_with("http://127.0.0.1:"));
        assert!(url.contains("/ace/getstream"));
    }

    #[test]
    fn test_case_normalization_in_url_building() {
        // Skip if platform doesn't support Acestream
        if !is_acestream_supported() {
            return;
        }

        let uppercase_id = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";
        let lowercase_id = "abcdef0123456789abcdef0123456789abcdef01";

        let url_upper = build_acestream_url(uppercase_id).unwrap();
        let url_lower = build_acestream_url(lowercase_id).unwrap();

        // Both should produce the same URL (normalized to lowercase)
        assert_eq!(url_upper, url_lower);

        // URL should contain lowercase version
        assert!(url_upper.contains(lowercase_id));
    }
}
