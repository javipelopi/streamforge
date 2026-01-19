//! XMLTV fetcher for downloading and decompressing EPG data

use flate2::read::GzDecoder;
use std::io::Read;
use std::time::Duration;

use super::parser::detect_gzip;
use super::types::XmltvError;

/// Maximum download timeout in seconds
const DOWNLOAD_TIMEOUT_SECS: u64 = 30;

/// Fetch XMLTV data from a URL
///
/// Handles both plain XML and gzipped (.xml.gz) formats.
/// Auto-detects gzip format from magic bytes or content-type header.
///
/// # Arguments
/// * `url` - The URL to fetch XMLTV data from
/// * `format` - The format hint: "xml", "xml_gz", or "auto"
///
/// # Returns
/// The decompressed XMLTV data as bytes
pub async fn fetch_xmltv(url: &str, format: &str) -> Result<Vec<u8>, XmltvError> {
    // Validate URL for SSRF protection
    validate_url_for_ssrf(url)?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .build()
        .map_err(|e| XmltvError::DownloadError(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| XmltvError::DownloadError(format!("Failed to fetch URL: {}", e)))?;

    if !response.status().is_success() {
        return Err(XmltvError::DownloadError(format!(
            "HTTP error: {}",
            response.status()
        )));
    }

    // Check content-type header for gzip hint
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let is_gzip_content_type =
        content_type.contains("gzip") || content_type.contains("application/x-gzip");

    // Download the response body
    let data = response
        .bytes()
        .await
        .map_err(|e| XmltvError::DownloadError(format!("Failed to read response body: {}", e)))?
        .to_vec();

    // Determine if we need to decompress
    let should_decompress = match format {
        "xml_gz" => true,
        "xml" => false,
        "auto" | _ => {
            // Auto-detect: check magic bytes first, then content-type
            detect_gzip(&data) || is_gzip_content_type
        }
    };

    if should_decompress {
        decompress_gzip(&data)
    } else {
        Ok(data)
    }
}

/// Decompress gzip data
fn decompress_gzip(compressed: &[u8]) -> Result<Vec<u8>, XmltvError> {
    let mut decoder = GzDecoder::new(compressed);
    let mut decompressed = Vec::new();

    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| XmltvError::DecompressError(format!("Gzip decompression failed: {}", e)))?;

    Ok(decompressed)
}

/// Validate URL for SSRF protection
///
/// Blocks localhost, private IPs, and non-HTTP(S) schemes.
/// In test mode (IPTV_TEST_MODE=1), localhost is allowed for mock servers.
fn validate_url_for_ssrf(url_str: &str) -> Result<(), XmltvError> {
    // In test mode, allow localhost for mock servers
    let test_mode = std::env::var("IPTV_TEST_MODE").unwrap_or_default() == "1";
    let parsed =
        url::Url::parse(url_str).map_err(|e| XmltvError::UrlNotAllowed(format!("Invalid URL: {}", e)))?;

    // Only allow HTTP and HTTPS
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(XmltvError::UrlNotAllowed(format!(
            "URL scheme '{}' is not allowed. Use http or https.",
            parsed.scheme()
        )));
    }

    // Check for SSRF - block localhost and private IPs
    if let Some(host) = parsed.host_str() {
        let host_lower = host.to_lowercase();

        // Block localhost variants (unless in test mode)
        if !test_mode
            && (host_lower == "localhost"
                || host_lower == "127.0.0.1"
                || host_lower.starts_with("127.")
                || host_lower == "::1"
                || host_lower == "0.0.0.0")
        {
            return Err(XmltvError::UrlNotAllowed(
                "Localhost URLs are not allowed".into(),
            ));
        }

        // Block private IP ranges
        if host_lower.starts_with("10.")
            || host_lower.starts_with("192.168.")
            || is_172_private(&host_lower)
            || host_lower.starts_with("169.254.")
        {
            return Err(XmltvError::UrlNotAllowed(
                "Private IP addresses are not allowed".into(),
            ));
        }
    }

    Ok(())
}

/// Check if host is in the 172.16.0.0/12 private range
fn is_172_private(host: &str) -> bool {
    if !host.starts_with("172.") {
        return false;
    }

    // Parse the second octet
    let parts: Vec<&str> = host.split('.').collect();
    if parts.len() < 2 {
        return false;
    }

    if let Ok(second_octet) = parts[1].parse::<u8>() {
        // 172.16.0.0 - 172.31.255.255 is private
        return (16..=31).contains(&second_octet);
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_valid() {
        assert!(validate_url_for_ssrf("https://example.com/epg.xml").is_ok());
        assert!(validate_url_for_ssrf("http://example.com/epg.xml").is_ok());
        assert!(validate_url_for_ssrf("https://example.com/epg.xml.gz").is_ok());
    }

    #[test]
    fn test_validate_url_blocked_localhost() {
        assert!(validate_url_for_ssrf("http://localhost/epg.xml").is_err());
        assert!(validate_url_for_ssrf("http://127.0.0.1/epg.xml").is_err());
        assert!(validate_url_for_ssrf("http://127.0.0.2/epg.xml").is_err());
        assert!(validate_url_for_ssrf("http://0.0.0.0/epg.xml").is_err());
    }

    #[test]
    fn test_validate_url_blocked_private_ips() {
        assert!(validate_url_for_ssrf("http://10.0.0.1/epg.xml").is_err());
        assert!(validate_url_for_ssrf("http://192.168.1.1/epg.xml").is_err());
        assert!(validate_url_for_ssrf("http://172.16.0.1/epg.xml").is_err());
        assert!(validate_url_for_ssrf("http://172.31.255.255/epg.xml").is_err());
        assert!(validate_url_for_ssrf("http://169.254.1.1/epg.xml").is_err());
    }

    #[test]
    fn test_validate_url_allowed_172_public() {
        // 172.32.0.0 and beyond is not private
        assert!(validate_url_for_ssrf("http://172.32.0.1/epg.xml").is_ok());
        assert!(validate_url_for_ssrf("http://172.15.0.1/epg.xml").is_ok());
    }

    #[test]
    fn test_validate_url_blocked_schemes() {
        assert!(validate_url_for_ssrf("ftp://example.com/epg.xml").is_err());
        assert!(validate_url_for_ssrf("file:///etc/passwd").is_err());
    }

    #[test]
    fn test_decompress_gzip() {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;

        let original = b"<?xml version=\"1.0\"?><tv></tv>";

        // Compress
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(original).unwrap();
        let compressed = encoder.finish().unwrap();

        // Verify it's detected as gzip
        assert!(detect_gzip(&compressed));

        // Decompress
        let decompressed = decompress_gzip(&compressed).unwrap();
        assert_eq!(decompressed, original);
    }
}
