//! M3U Playlist Generation Module
//!
//! This module generates M3U playlists for Plex integration following the
//! XMLTV-first architecture where XMLTV channels define the Plex lineup
//! and Xtream streams are video sources.
//!
//! Story 4-1: Serve M3U Playlist Endpoint

use diesel::prelude::*;
use diesel::sql_types::{Integer, Nullable, Text};

use crate::db::DbPooledConnection;

/// Internal representation of a channel for M3U generation
#[derive(Debug, Clone)]
pub struct M3uChannel {
    /// Database ID of the XMLTV channel
    pub xmltv_channel_id: i32,
    /// Display name from XMLTV (used in playlist)
    pub display_name: String,
    /// Channel number for Plex (from plex_display_order)
    pub channel_number: i32,
    /// Logo URL (XMLTV icon with Xtream fallback)
    pub logo_url: Option<String>,
    /// XMLTV channel_id (used for tvg-id attribute)
    pub tvg_id: String,
}

/// Query result for enabled channels with resolved logos
#[derive(QueryableByName, Debug)]
struct EnabledChannelRow {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Text)]
    channel_id: String,
    #[diesel(sql_type = Text)]
    display_name: String,
    #[diesel(sql_type = Nullable<Text>)]
    icon: Option<String>,
    #[diesel(sql_type = Nullable<Integer>)]
    plex_display_order: Option<i32>,
    #[diesel(sql_type = Nullable<Text>)]
    xtream_fallback_icon: Option<String>,
}

/// Query result for Xtream stream icon fallback
#[derive(QueryableByName, Debug)]
struct XtreamIconRow {
    #[diesel(sql_type = Nullable<Text>)]
    stream_icon: Option<String>,
}

/// Get enabled XMLTV channels that have at least one Xtream stream mapping
///
/// Channels are ordered by plex_display_order (ascending, nulls last)
/// then by display_name (ascending) for channels without explicit order.
///
/// Performance optimized: Single query with LEFT JOIN to get Xtream fallback icons,
/// eliminating N+1 query pattern.
pub fn get_enabled_channels_for_m3u(conn: &mut DbPooledConnection) -> Result<Vec<M3uChannel>, diesel::result::Error> {
    // Query enabled XMLTV channels with their settings and Xtream fallback icon in ONE query
    // Uses subquery to get the best Xtream icon for fallback (primary first, then highest priority)
    let rows = diesel::sql_query(
        r#"
        SELECT
            xc.id,
            xc.channel_id,
            xc.display_name,
            xc.icon,
            xcs.plex_display_order,
            (
                SELECT xtc.stream_icon
                FROM channel_mappings cm
                INNER JOIN xtream_channels xtc ON cm.xtream_channel_id = xtc.id
                WHERE cm.xmltv_channel_id = xc.id
                ORDER BY
                    CASE WHEN cm.is_primary = 1 THEN 0 ELSE 1 END,
                    cm.stream_priority ASC,
                    cm.id ASC
                LIMIT 1
            ) as xtream_fallback_icon
        FROM xmltv_channels xc
        INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
        WHERE xcs.is_enabled = 1
        AND EXISTS (
            SELECT 1 FROM channel_mappings cm
            WHERE cm.xmltv_channel_id = xc.id
        )
        ORDER BY
            CASE WHEN xcs.plex_display_order IS NULL THEN 1 ELSE 0 END,
            xcs.plex_display_order ASC,
            xc.display_name ASC
        "#,
    )
    .load::<EnabledChannelRow>(conn)?;

    // Convert to M3uChannel with logo resolution (no additional queries needed!)
    let mut channels = Vec::with_capacity(rows.len());

    // Find max explicit channel number to avoid collisions with fallback numbering
    // e.g., if channels have plex_display_order 0,2,5 -> channel numbers 1,3,6
    // fallback should start at 7, not 1
    let max_explicit_channel = rows
        .iter()
        .filter_map(|r| r.plex_display_order)
        .map(|o| o + 1)
        .max()
        .unwrap_or(0);

    let mut fallback_number = max_explicit_channel + 1;

    for row in rows {
        // Logo priority: XMLTV icon -> Xtream fallback -> None
        let logo_url = if let Some(icon) = row.icon.as_ref().filter(|s| !s.trim().is_empty()) {
            Some(icon.clone())
        } else if let Some(fallback) = row.xtream_fallback_icon.as_ref().filter(|s| !s.trim().is_empty()) {
            Some(fallback.clone())
        } else {
            None
        };

        // Convert 0-indexed plex_display_order to 1-indexed channel number
        let channel_number = match row.plex_display_order {
            Some(order) => order + 1,
            None => {
                let num = fallback_number;
                fallback_number += 1;
                num
            }
        };

        channels.push(M3uChannel {
            xmltv_channel_id: row.id,
            display_name: row.display_name,
            channel_number,
            logo_url,
            tvg_id: row.channel_id,
        });
    }

    Ok(channels)
}

/// Resolve the logo URL for a channel
///
/// **DEPRECATED**: Logo resolution is now done in the main query for performance.
/// This function is kept for backward compatibility only.
///
/// Priority order:
/// 1. XMLTV channel icon (if not null/empty)
/// 2. Primary Xtream stream icon (fallback)
/// 3. No logo (returns None)
#[allow(dead_code)]
pub fn resolve_channel_logo(
    conn: &mut DbPooledConnection,
    xmltv_channel_id: i32,
    xmltv_icon: Option<&str>,
) -> Result<Option<String>, diesel::result::Error> {
    // Use XMLTV icon if available and not empty
    if let Some(icon) = xmltv_icon {
        if !icon.trim().is_empty() {
            return Ok(Some(icon.to_string()));
        }
    }

    // Fallback to primary Xtream stream icon
    // Priority: 1) Primary stream (is_primary=1), 2) Highest priority stream, 3) First by ID
    let xtream_icon = diesel::sql_query(
        r#"
        SELECT xtc.stream_icon
        FROM channel_mappings cm
        INNER JOIN xtream_channels xtc ON cm.xtream_channel_id = xtc.id
        WHERE cm.xmltv_channel_id = ?
        ORDER BY
            CASE WHEN cm.is_primary = 1 THEN 0 ELSE 1 END,
            cm.stream_priority ASC,
            cm.id ASC
        LIMIT 1
        "#,
    )
    .bind::<Integer, _>(xmltv_channel_id)
    .load::<XtreamIconRow>(conn)?;

    if let Some(row) = xtream_icon.first() {
        if let Some(icon) = &row.stream_icon {
            if !icon.trim().is_empty() {
                return Ok(Some(icon.clone()));
            }
        }
    }

    Ok(None)
}

/// Generate the M3U playlist content
///
/// Returns a properly formatted M3U8 playlist string with:
/// - #EXTM3U header
/// - EXTINF entries for each enabled channel
/// - Stream URLs pointing to /stream/{xmltv_channel_id}
///
/// For large channel counts (>1000), consider using streaming response to reduce memory usage.
/// This implementation builds the full string for simplicity and Plex compatibility.
pub fn generate_m3u_playlist(conn: &mut DbPooledConnection, port: u16) -> Result<String, diesel::result::Error> {
    let channels = get_enabled_channels_for_m3u(conn)?;

    // Pre-allocate estimated capacity: ~200 bytes per channel + header
    let estimated_size = 50 + (channels.len() * 200);
    let mut output = String::with_capacity(estimated_size);

    output.push_str("#EXTM3U\n");

    for channel in &channels {
        generate_channel_entry(&mut output, channel, port);
    }

    Ok(output)
}

/// Generate a single M3U channel entry and append to output string
///
/// Extracted for potential streaming implementation in future.
fn generate_channel_entry(output: &mut String, channel: &M3uChannel, port: u16) {
    // Build EXTINF line with attributes
    output.push_str(&format!(
        "#EXTINF:-1 tvg-id=\"{}\" tvg-name=\"{}\"",
        escape_m3u_attribute(&channel.tvg_id),
        escape_m3u_attribute(&channel.display_name)
    ));

    // Add logo if available
    if let Some(ref logo) = channel.logo_url {
        output.push_str(&format!(" tvg-logo=\"{}\"", escape_m3u_attribute(logo)));
    }

    // Add channel number
    output.push_str(&format!(" tvg-chno=\"{}\"", channel.channel_number));

    // Add display name after comma
    output.push_str(&format!(",{}\n", channel.display_name));

    // Add stream URL
    output.push_str(&format!("http://127.0.0.1:{}/stream/{}\n", port, channel.xmltv_channel_id));
}

/// Generate M3U playlist content from a list of channels
///
/// This is the core M3U generation logic, separated from database queries
/// to allow unit testing without a database connection.
///
/// Pre-allocates string capacity based on channel count for better performance.
pub fn generate_m3u_from_channels(channels: &[M3uChannel], port: u16) -> String {
    // Pre-allocate estimated capacity: ~200 bytes per channel + header
    let estimated_size = 50 + (channels.len() * 200);
    let mut output = String::with_capacity(estimated_size);

    output.push_str("#EXTM3U\n");

    for channel in channels {
        generate_channel_entry(&mut output, channel, port);
    }

    output
}

/// Escape special characters in M3U attribute values
fn escape_m3u_attribute(value: &str) -> String {
    // Escape double quotes and newlines in attribute values
    value.replace('\"', "&quot;").replace('\n', " ").replace('\r', "")
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper function to create a test channel
    fn create_test_channel(
        id: i32,
        name: &str,
        channel_number: i32,
        logo: Option<&str>,
        tvg_id: &str,
    ) -> M3uChannel {
        M3uChannel {
            xmltv_channel_id: id,
            display_name: name.to_string(),
            channel_number,
            logo_url: logo.map(|s| s.to_string()),
            tvg_id: tvg_id.to_string(),
        }
    }

    // ============================================================================
    // Attribute escaping tests
    // ============================================================================

    #[test]
    fn test_escape_m3u_attribute_with_quotes() {
        let input = "Channel \"Test\" Name";
        let result = escape_m3u_attribute(input);
        assert_eq!(result, "Channel &quot;Test&quot; Name");
    }

    #[test]
    fn test_escape_m3u_attribute_with_newlines() {
        let input = "Channel\nName";
        let result = escape_m3u_attribute(input);
        assert_eq!(result, "Channel Name");
    }

    #[test]
    fn test_escape_m3u_attribute_with_carriage_return() {
        let input = "Channel\r\nName";
        let result = escape_m3u_attribute(input);
        assert_eq!(result, "Channel Name");
    }

    #[test]
    fn test_escape_m3u_attribute_plain() {
        let input = "ESPN HD";
        let result = escape_m3u_attribute(input);
        assert_eq!(result, "ESPN HD");
    }

    #[test]
    fn test_escape_m3u_attribute_unicode() {
        let input = "Tëst Chànnél ñ";
        let result = escape_m3u_attribute(input);
        assert_eq!(result, "Tëst Chànnél ñ");
    }

    // ============================================================================
    // Empty playlist tests
    // ============================================================================

    #[test]
    fn test_generate_empty_playlist() {
        let channels: Vec<M3uChannel> = vec![];
        let result = generate_m3u_from_channels(&channels, 5004);

        // Empty playlist should only have the header
        assert_eq!(result.trim(), "#EXTM3U");
    }

    // ============================================================================
    // Single channel tests
    // ============================================================================

    #[test]
    fn test_generate_single_channel_with_logo() {
        let channels = vec![create_test_channel(
            123,
            "ESPN HD",
            206,
            Some("http://example.com/espn.png"),
            "ESPN.US",
        )];

        let result = generate_m3u_from_channels(&channels, 5004);

        // Verify header
        assert!(result.starts_with("#EXTM3U\n"));

        // Verify EXTINF line
        assert!(result.contains("#EXTINF:-1 tvg-id=\"ESPN.US\" tvg-name=\"ESPN HD\""));
        assert!(result.contains("tvg-logo=\"http://example.com/espn.png\""));
        assert!(result.contains("tvg-chno=\"206\""));
        assert!(result.contains(",ESPN HD\n"));

        // Verify stream URL
        assert!(result.contains("http://127.0.0.1:5004/stream/123\n"));
    }

    #[test]
    fn test_generate_single_channel_without_logo() {
        let channels = vec![create_test_channel(456, "CNN", 207, None, "CNN.US")];

        let result = generate_m3u_from_channels(&channels, 5004);

        // Verify EXTINF line without logo
        assert!(result.contains("#EXTINF:-1 tvg-id=\"CNN.US\" tvg-name=\"CNN\""));
        assert!(!result.contains("tvg-logo="));
        assert!(result.contains("tvg-chno=\"207\""));
        assert!(result.contains(",CNN\n"));

        // Verify stream URL
        assert!(result.contains("http://127.0.0.1:5004/stream/456\n"));
    }

    // ============================================================================
    // Multiple channels tests
    // ============================================================================

    #[test]
    fn test_generate_multiple_channels_preserves_order() {
        let channels = vec![
            create_test_channel(1, "Channel 1", 1, None, "CH1"),
            create_test_channel(2, "Channel 2", 2, None, "CH2"),
            create_test_channel(3, "Channel 3", 3, None, "CH3"),
        ];

        let result = generate_m3u_from_channels(&channels, 5004);

        // Check that channels appear in order
        let pos1 = result.find("Channel 1").unwrap();
        let pos2 = result.find("Channel 2").unwrap();
        let pos3 = result.find("Channel 3").unwrap();

        assert!(pos1 < pos2);
        assert!(pos2 < pos3);
    }

    #[test]
    fn test_generate_channels_with_different_channel_numbers() {
        let channels = vec![
            create_test_channel(10, "ABC", 100, None, "ABC.US"),
            create_test_channel(20, "NBC", 200, None, "NBC.US"),
            create_test_channel(30, "CBS", 300, None, "CBS.US"),
        ];

        let result = generate_m3u_from_channels(&channels, 5004);

        assert!(result.contains("tvg-chno=\"100\""));
        assert!(result.contains("tvg-chno=\"200\""));
        assert!(result.contains("tvg-chno=\"300\""));
    }

    // ============================================================================
    // Port configuration tests
    // ============================================================================

    #[test]
    fn test_generate_playlist_uses_specified_port() {
        let channels = vec![create_test_channel(1, "Test", 1, None, "TEST")];

        let result_5004 = generate_m3u_from_channels(&channels, 5004);
        let result_8080 = generate_m3u_from_channels(&channels, 8080);

        assert!(result_5004.contains("http://127.0.0.1:5004/stream/1"));
        assert!(result_8080.contains("http://127.0.0.1:8080/stream/1"));
    }

    // ============================================================================
    // Stream URL format tests
    // ============================================================================

    #[test]
    fn test_stream_url_uses_localhost() {
        let channels = vec![create_test_channel(999, "Test", 1, None, "TEST")];
        let result = generate_m3u_from_channels(&channels, 5004);

        // Verify localhost (127.0.0.1) is used
        assert!(result.contains("http://127.0.0.1:"));
        assert!(!result.contains("http://0.0.0.0:"));
        assert!(!result.contains("http://localhost:"));
    }

    #[test]
    fn test_stream_url_uses_xmltv_channel_id() {
        let channels = vec![
            create_test_channel(123, "ESPN", 1, None, "ESPN.US"),
            create_test_channel(456, "CNN", 2, None, "CNN.US"),
        ];

        let result = generate_m3u_from_channels(&channels, 5004);

        // Stream URLs should use xmltv_channel_id (123, 456), not other IDs
        assert!(result.contains("/stream/123"));
        assert!(result.contains("/stream/456"));
    }

    // ============================================================================
    // Special character handling tests
    // ============================================================================

    #[test]
    fn test_channel_name_with_quotes_escaped() {
        let channels = vec![create_test_channel(1, "Channel \"With\" Quotes", 1, None, "TEST")];

        let result = generate_m3u_from_channels(&channels, 5004);

        // tvg-name should have escaped quotes
        assert!(result.contains("tvg-name=\"Channel &quot;With&quot; Quotes\""));
        // Display name after comma should be unescaped (readable)
        assert!(result.contains(",Channel \"With\" Quotes\n"));
    }

    #[test]
    fn test_logo_url_with_special_chars_escaped() {
        let channels = vec![create_test_channel(
            1,
            "Test",
            1,
            Some("http://example.com/logo?name=\"test\""),
            "TEST",
        )];

        let result = generate_m3u_from_channels(&channels, 5004);

        // Logo URL should have escaped quotes
        assert!(result.contains("tvg-logo=\"http://example.com/logo?name=&quot;test&quot;\""));
    }

    // ============================================================================
    // M3U format validation tests
    // ============================================================================

    #[test]
    fn test_m3u_format_structure() {
        let channels = vec![create_test_channel(1, "ESPN", 206, Some("http://espn.png"), "ESPN.US")];

        let result = generate_m3u_from_channels(&channels, 5004);
        let lines: Vec<&str> = result.lines().collect();

        // First line should be #EXTM3U
        assert_eq!(lines[0], "#EXTM3U");

        // Second line should be #EXTINF
        assert!(lines[1].starts_with("#EXTINF:-1"));

        // Third line should be stream URL
        assert!(lines[2].starts_with("http://"));
    }

    #[test]
    fn test_m3u_extinf_attribute_order() {
        let channels = vec![create_test_channel(1, "Test", 100, Some("http://logo.png"), "TEST.ID")];

        let result = generate_m3u_from_channels(&channels, 5004);

        // Verify the attribute order: tvg-id, tvg-name, tvg-logo, tvg-chno
        let extinf_line = result.lines().nth(1).unwrap();

        let id_pos = extinf_line.find("tvg-id=").unwrap();
        let name_pos = extinf_line.find("tvg-name=").unwrap();
        let logo_pos = extinf_line.find("tvg-logo=").unwrap();
        let chno_pos = extinf_line.find("tvg-chno=").unwrap();

        assert!(id_pos < name_pos);
        assert!(name_pos < logo_pos);
        assert!(logo_pos < chno_pos);
    }

    // ============================================================================
    // Synthetic channel tests
    // ============================================================================

    #[test]
    fn test_synthetic_channel_included_same_as_regular() {
        // Synthetic channels should be treated identically to regular channels
        // in M3U generation (the is_synthetic flag doesn't affect M3U output)
        let channels = vec![create_test_channel(
            777,
            "My Custom Channel",
            500,
            Some("http://custom.png"),
            "SYNTHETIC.777",
        )];

        let result = generate_m3u_from_channels(&channels, 5004);

        assert!(result.contains("tvg-id=\"SYNTHETIC.777\""));
        assert!(result.contains("tvg-name=\"My Custom Channel\""));
        assert!(result.contains("tvg-logo=\"http://custom.png\""));
        assert!(result.contains("tvg-chno=\"500\""));
        assert!(result.contains("http://127.0.0.1:5004/stream/777"));
    }
}
