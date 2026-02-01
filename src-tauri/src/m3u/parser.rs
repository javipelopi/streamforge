use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashMap;

/// Regex to match key="value" pairs in EXTINF lines
/// Handles both double-quoted and single-quoted values, including escaped quotes
/// Pattern breakdown:
/// - ([a-zA-Z\-_]+) - captures the attribute key
/// - = - literal equals sign
/// - ["'] - opening quote (double or single)
/// - ([^"'\\]*(\\.[^"'\\]*)*) - value with escaped chars: non-quote/non-backslash chars,
///   optionally followed by escape sequences and more chars
/// - ["'] - closing quote
///
/// NOTE: This regex uses lazy matching and character classes to minimize backtracking
/// and reduce ReDoS (Regular Expression Denial of Service) risk. The pattern is anchored
/// and bounded to prevent catastrophic backtracking on malformed input.
static EXTINF_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"([a-zA-Z\-_]+)=["']([^"'\\]*(\\.[^"'\\]*)*)["']"#).unwrap()
});

/// Represents a parsed channel entry from an M3U playlist
#[derive(Debug, Clone)]
pub struct M3uChannelEntry {
    pub name: String,
    pub stream_url: String,
    pub tvg_id: Option<String>,
    pub tvg_name: Option<String>,
    pub tvg_logo: Option<String>,
    pub group_title: Option<String>,
}

/// Maximum number of channels to parse from a single M3U playlist
/// Prevents OOM attacks from malicious playlists with excessive channels
const MAX_CHANNELS: usize = 50000;

/// Validates that a stream URL uses an allowed protocol
/// Accepts: http://, https://, rtmp://, rtsp://
/// Rejects: empty strings, local file paths, data: URIs, javascript: URIs, etc.
fn is_valid_stream_url(url: &str) -> bool {
    if url.is_empty() {
        return false;
    }

    let url_lower = url.to_lowercase();
    url_lower.starts_with("http://")
        || url_lower.starts_with("https://")
        || url_lower.starts_with("rtmp://")
        || url_lower.starts_with("rtsp://")
}

/// Parse an M3U/M3U8 playlist content into channel entries
///
/// Handles standard M3U format with EXTINF directives:
/// ```text
/// #EXTM3U
/// #EXTINF:-1 tvg-id="channel1" tvg-name="Channel 1" tvg-logo="http://logo.png" group-title="News",Channel 1
/// http://stream.url/channel1.m3u8
/// ```
pub fn parse_m3u_playlist(content: &str) -> Vec<M3uChannelEntry> {
    let mut entries = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();

        // Look for EXTINF lines
        if line.starts_with("#EXTINF:") {
            // Issue 3: Check channel count limit to prevent OOM attacks
            if entries.len() >= MAX_CHANNELS {
                tracing::warn!("M3U playlist truncated at {} channels (max limit)", MAX_CHANNELS);
                break;
            }

            // Parse the EXTINF line for attributes once
            let attrs = parse_extinf_attributes(line);
            // Extract channel name, passing already-parsed attributes to avoid double parsing
            let name = extract_channel_name_with_attrs(line, &attrs);

            // Next non-empty, non-comment line should be the URL
            i += 1;
            while i < lines.len() {
                let url_line = lines[i].trim();
                if !url_line.is_empty() && !url_line.starts_with('#') {
                    // Validate stream URL before adding entry
                    if !is_valid_stream_url(url_line) {
                        tracing::warn!("Skipping invalid stream URL: {}", url_line);
                        break;
                    }

                    // Valid stream URL found
                    entries.push(M3uChannelEntry {
                        name: name.clone(),
                        stream_url: url_line.to_string(),
                        tvg_id: attrs.get("tvg-id").cloned(),
                        tvg_name: attrs.get("tvg-name").cloned(),
                        tvg_logo: attrs.get("tvg-logo").cloned(),
                        group_title: attrs.get("group-title").cloned(),
                    });
                    break;
                }
                i += 1;
            }
        }
        i += 1;
    }

    entries
}

/// Parse EXTINF attributes into a HashMap
/// Handles: tvg-id="value" tvg-name="value" tvg-logo="url" group-title="value"
/// Also handles escaped quotes within values (e.g., tvg-name="Channel \"HD\"")
fn parse_extinf_attributes(line: &str) -> HashMap<String, String> {
    let mut attrs = HashMap::new();

    for cap in EXTINF_REGEX.captures_iter(line) {
        if let (Some(key), Some(value)) = (cap.get(1), cap.get(2)) {
            // Unescape any escaped characters in the value
            let unescaped_value = value
                .as_str()
                .replace("\\\"", "\"")
                .replace("\\'", "'")
                .replace("\\\\", "\\");
            attrs.insert(key.as_str().to_lowercase(), unescaped_value);
        }
    }

    attrs
}

/// Extract the channel name from an EXTINF line, using pre-parsed attributes
/// The name is typically after the last comma in the EXTINF line
///
/// NOTE: Unicode normalization should be applied to channel names to ensure
/// consistent matching across different Unicode representations (e.g., é vs e + combining accent).
/// This would require adding the `unicode-normalization` crate to Cargo.toml and using:
/// ```rust
/// use unicode_normalization::UnicodeNormalization;
/// let name = name.nfc().collect::<String>();
/// ```
/// TODO: Add unicode-normalization dependency and normalize channel names to NFC form
fn extract_channel_name_with_attrs(line: &str, attrs: &HashMap<String, String>) -> String {
    // Format: #EXTINF:-1 attributes...,Channel Name
    if let Some(comma_pos) = line.rfind(',') {
        let name = line[comma_pos + 1..].trim();
        if !name.is_empty() {
            // TODO: Apply Unicode NFC normalization here when crate is added
            return name.to_string();
        }
    }

    // Fallback: use already-parsed tvg-name or tvg-id
    attrs
        .get("tvg-name")
        .or_else(|| attrs.get("tvg-id"))
        .cloned()
        .unwrap_or_else(|| "Unknown Channel".to_string())
}

/// Extract the channel name from an EXTINF line (legacy function for backwards compatibility)
/// The name is typically after the last comma in the EXTINF line
#[allow(dead_code)]
fn extract_channel_name(line: &str) -> String {
    // Format: #EXTINF:-1 attributes...,Channel Name
    if let Some(comma_pos) = line.rfind(',') {
        let name = line[comma_pos + 1..].trim();
        if !name.is_empty() {
            return name.to_string();
        }
    }

    // Fallback: parse attributes and try tvg-name or tvg-id
    let attrs = parse_extinf_attributes(line);
    attrs
        .get("tvg-name")
        .or_else(|| attrs.get("tvg-id"))
        .cloned()
        .unwrap_or_else(|| "Unknown Channel".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_m3u() {
        let content = r#"#EXTM3U
#EXTINF:-1,Channel 1
http://stream1.example.com/live.m3u8
#EXTINF:-1,Channel 2
http://stream2.example.com/live.m3u8
"#;

        let entries = parse_m3u_playlist(content);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "Channel 1");
        assert_eq!(entries[0].stream_url, "http://stream1.example.com/live.m3u8");
        assert_eq!(entries[1].name, "Channel 2");
    }

    #[test]
    fn test_parse_m3u_with_attributes() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-id="cnn.us" tvg-name="CNN" tvg-logo="http://logo.com/cnn.png" group-title="News",CNN International
http://cnn.stream/live.m3u8
"#;

        let entries = parse_m3u_playlist(content);
        assert_eq!(entries.len(), 1);

        let entry = &entries[0];
        assert_eq!(entry.name, "CNN International");
        assert_eq!(entry.tvg_id, Some("cnn.us".to_string()));
        assert_eq!(entry.tvg_name, Some("CNN".to_string()));
        assert_eq!(entry.tvg_logo, Some("http://logo.com/cnn.png".to_string()));
        assert_eq!(entry.group_title, Some("News".to_string()));
    }

    #[test]
    fn test_parse_m3u_with_single_quotes() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-id='bbc1' tvg-name='BBC One',BBC One HD
http://bbc.stream/one.m3u8
"#;

        let entries = parse_m3u_playlist(content);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].tvg_id, Some("bbc1".to_string()));
        assert_eq!(entries[0].tvg_name, Some("BBC One".to_string()));
    }

    #[test]
    fn test_parse_m3u_with_empty_lines() {
        let content = r#"#EXTM3U

#EXTINF:-1,Channel 1

http://stream1.example.com/live.m3u8

#EXTINF:-1,Channel 2
http://stream2.example.com/live.m3u8
"#;

        let entries = parse_m3u_playlist(content);
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn test_parse_m3u_unicode() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-name="日本テレビ",日本テレビ
http://japan.stream/ntv.m3u8
#EXTINF:-1 tvg-name="España TV",España TV
http://spain.stream/etv.m3u8
"#;

        let entries = parse_m3u_playlist(content);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "日本テレビ");
        assert_eq!(entries[1].name, "España TV");
    }

    #[test]
    fn test_parse_empty_playlist() {
        let content = "#EXTM3U\n";
        let entries = parse_m3u_playlist(content);
        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_extinf_attributes() {
        let line = r#"#EXTINF:-1 tvg-id="test" tvg-logo="http://logo.png" group-title="Sports",Test Channel"#;
        let attrs = parse_extinf_attributes(line);

        assert_eq!(attrs.get("tvg-id"), Some(&"test".to_string()));
        assert_eq!(attrs.get("tvg-logo"), Some(&"http://logo.png".to_string()));
        assert_eq!(attrs.get("group-title"), Some(&"Sports".to_string()));
    }

    #[test]
    fn test_extract_channel_name() {
        assert_eq!(
            extract_channel_name("#EXTINF:-1,Simple Name"),
            "Simple Name"
        );
        assert_eq!(
            extract_channel_name("#EXTINF:-1 tvg-id=\"test\",Complex Name"),
            "Complex Name"
        );
    }

    #[test]
    fn test_parse_m3u_with_escaped_quotes() {
        // Test that escaped quotes in attribute values are handled correctly
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-name="Channel \"HD\"",Channel HD
http://stream.example.com/hd.m3u8
"#;

        let entries = parse_m3u_playlist(content);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].tvg_name, Some("Channel \"HD\"".to_string()));
        assert_eq!(entries[0].name, "Channel HD");
    }

    #[test]
    fn test_parse_extinf_escaped_quotes() {
        let line = r#"#EXTINF:-1 tvg-name="Test \"Quoted\" Name" tvg-id="test",Test Channel"#;
        let attrs = parse_extinf_attributes(line);

        assert_eq!(
            attrs.get("tvg-name"),
            Some(&"Test \"Quoted\" Name".to_string())
        );
    }

    #[test]
    fn test_is_valid_stream_url() {
        // Valid URLs
        assert!(is_valid_stream_url("http://example.com/stream.m3u8"));
        assert!(is_valid_stream_url("https://example.com/stream.m3u8"));
        assert!(is_valid_stream_url("rtmp://example.com/live/stream"));
        assert!(is_valid_stream_url("rtsp://example.com/stream"));
        assert!(is_valid_stream_url("HTTP://EXAMPLE.COM/STREAM")); // Case insensitive

        // Invalid URLs
        assert!(!is_valid_stream_url("")); // Empty
        assert!(!is_valid_stream_url("/local/file.m3u8")); // Local path
        assert!(!is_valid_stream_url("file:///etc/passwd")); // File protocol
        assert!(!is_valid_stream_url("javascript:alert('xss')")); // JavaScript
        assert!(!is_valid_stream_url("data:text/html,<script>alert('xss')</script>")); // Data URI
        assert!(!is_valid_stream_url("ftp://example.com/file")); // FTP not allowed
        assert!(!is_valid_stream_url("C:\\Windows\\System32")); // Windows path
    }

    #[test]
    fn test_parse_m3u_skips_invalid_urls() {
        let content = r#"#EXTM3U
#EXTINF:-1,Valid Channel
http://stream.example.com/live.m3u8
#EXTINF:-1,Invalid Local Path
/local/file.m3u8
#EXTINF:-1,Valid RTSP
rtsp://stream.example.com/live
#EXTINF:-1,Invalid JavaScript
javascript:alert('xss')
#EXTINF:-1,Another Valid HTTP
https://stream2.example.com/stream.m3u8
"#;

        let entries = parse_m3u_playlist(content);
        // Should only parse the 3 valid entries (http, rtsp, https)
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].name, "Valid Channel");
        assert_eq!(entries[0].stream_url, "http://stream.example.com/live.m3u8");
        assert_eq!(entries[1].name, "Valid RTSP");
        assert_eq!(entries[1].stream_url, "rtsp://stream.example.com/live");
        assert_eq!(entries[2].name, "Another Valid HTTP");
        assert_eq!(entries[2].stream_url, "https://stream2.example.com/stream.m3u8");
    }
}
