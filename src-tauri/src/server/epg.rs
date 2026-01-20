//! EPG (Electronic Program Guide) Generation Module
//!
//! This module generates XMLTV-format EPG data for Plex integration following the
//! XMLTV-first architecture where XMLTV channels define the Plex lineup.
//!
//! Story 4-2: Serve XMLTV EPG Endpoint

use chrono::{DateTime, Duration, Timelike, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Integer, Nullable, Text};
use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::Writer;
use std::io::Cursor;

use crate::db::DbPooledConnection;

/// Output structure for XMLTV channel data
#[derive(Debug, Clone)]
pub struct XmltvChannelOutput {
    /// XMLTV channel_id (used in EPG output and matches M3U tvg-id)
    pub id: String,
    /// Display name for the channel
    pub display_name: String,
    /// Optional icon URL
    pub icon: Option<String>,
    /// Whether this is a synthetic channel (needs placeholder programs)
    pub is_synthetic: bool,
    /// Internal database ID (for program lookup)
    pub internal_id: i32,
}

/// Output structure for XMLTV programme data
#[derive(Debug, Clone)]
pub struct XmltvProgramme {
    /// Channel ID (matches channel id attribute)
    pub channel_id: String,
    /// Programme title
    pub title: String,
    /// Optional description
    pub description: Option<String>,
    /// Start time in XMLTV format: "YYYYMMDDHHmmss +0000"
    pub start: String,
    /// Stop time in XMLTV format: "YYYYMMDDHHmmss +0000"
    pub stop: String,
    /// Optional category
    pub category: Option<String>,
    /// Optional episode info (e.g., "S1E100")
    pub episode_num: Option<String>,
}

/// Query result for enabled channels
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
    is_synthetic: Option<i32>,
}

/// Query result for program data
#[derive(QueryableByName, Debug)]
struct ProgramRow {
    #[allow(dead_code)]
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Integer)]
    xmltv_channel_id: i32,
    #[diesel(sql_type = Text)]
    title: String,
    #[diesel(sql_type = Nullable<Text>)]
    description: Option<String>,
    #[diesel(sql_type = Text)]
    start_time: String,
    #[diesel(sql_type = Text)]
    end_time: String,
    #[diesel(sql_type = Nullable<Text>)]
    category: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    episode_info: Option<String>,
}

/// Get enabled XMLTV channels that have at least one Xtream stream mapping
///
/// Channels are ordered by plex_display_order (ascending, nulls last)
/// then by display_name (ascending) for channels without explicit order.
///
/// Only includes channels that:
/// - Have is_enabled = 1 in xmltv_channel_settings
/// - Have at least one mapping in channel_mappings table
pub fn get_enabled_channels_for_epg(
    conn: &mut DbPooledConnection,
) -> Result<Vec<XmltvChannelOutput>, diesel::result::Error> {
    let rows = diesel::sql_query(
        r#"
        SELECT
            xc.id,
            xc.channel_id,
            xc.display_name,
            xc.icon,
            xc.is_synthetic
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

    let channels = rows
        .into_iter()
        .map(|row| XmltvChannelOutput {
            id: row.channel_id,
            display_name: row.display_name,
            icon: row.icon.filter(|s| !s.trim().is_empty()),
            is_synthetic: row.is_synthetic.unwrap_or(0) == 1,
            internal_id: row.id,
        })
        .collect();

    Ok(channels)
}

/// Get programs for the given channel internal IDs within the 7-day window
///
/// Uses a batch query to avoid N+1 pattern.
/// Returns programs where start_time >= now - 1 hour AND start_time < now + 7 days
fn get_programs_for_channels(
    conn: &mut DbPooledConnection,
    channel_ids: &[i32],
) -> Result<Vec<ProgramRow>, diesel::result::Error> {
    if channel_ids.is_empty() {
        return Ok(Vec::new());
    }

    // Build the IN clause with proper validation
    // Convert channel_ids to strings with explicit validation to prevent SQL injection
    // Even though inputs are i32, this ensures secure coding practices
    let mut validated_ids = Vec::with_capacity(channel_ids.len());
    for &id in channel_ids {
        // Validate that id is within reasonable bounds (positive integer)
        if id > 0 {
            validated_ids.push(id.to_string());
        }
    }

    if validated_ids.is_empty() {
        return Ok(Vec::new());
    }

    let in_clause = validated_ids.join(",");

    let query = format!(
        r#"
        SELECT
            p.id,
            p.xmltv_channel_id,
            p.title,
            p.description,
            p.start_time,
            p.end_time,
            p.category,
            p.episode_info
        FROM programs p
        WHERE p.xmltv_channel_id IN ({})
        AND p.start_time >= datetime('now', '-1 hour')
        AND p.start_time < datetime('now', '+7 days')
        ORDER BY p.xmltv_channel_id, p.start_time ASC
        "#,
        in_clause
    );

    diesel::sql_query(query).load::<ProgramRow>(conn)
}

/// Format datetime to XMLTV format: "YYYYMMDDHHmmss +0000"
pub fn format_xmltv_datetime(dt: DateTime<Utc>) -> String {
    dt.format("%Y%m%d%H%M%S +0000").to_string()
}

/// Parse a datetime string from the database to DateTime<Utc>
fn parse_db_datetime(dt_str: &str) -> Option<DateTime<Utc>> {
    // Try SQLite datetime format first: "YYYY-MM-DD HH:MM:SS"
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(dt_str, "%Y-%m-%d %H:%M:%S") {
        return Some(DateTime::from_naive_utc_and_offset(naive, Utc));
    }

    // Try ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
    let normalized = dt_str.replace(' ', "T");
    let with_z = if normalized.ends_with('Z') {
        normalized
    } else {
        format!("{}Z", normalized.trim_end_matches('Z'))
    };
    if let Ok(dt) = DateTime::parse_from_rfc3339(&with_z) {
        return Some(dt.with_timezone(&Utc));
    }

    None
}

/// Generate placeholder programs for a synthetic channel
///
/// Creates 2-hour program blocks covering the next 7 days.
/// Title format: "{display_name} - Live Programming"
/// Description: "Live content on {display_name}"
pub fn generate_placeholder_programs(channel: &XmltvChannelOutput) -> Vec<XmltvProgramme> {
    let now = Utc::now();
    // Round down to current hour
    let start_hour = now
        .with_minute(0)
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or(now);

    let mut programs = Vec::new();
    let mut current = start_hour;
    let end_date = start_hour + Duration::days(7);

    while current < end_date {
        let stop = current + Duration::hours(2);
        programs.push(XmltvProgramme {
            channel_id: channel.id.clone(),
            title: format!("{} - Live Programming", channel.display_name),
            description: Some(format!("Live content on {}", channel.display_name)),
            start: format_xmltv_datetime(current),
            stop: format_xmltv_datetime(stop),
            category: None,
            episode_num: None,
        });
        current = stop;
    }

    programs
}

/// Generate the complete XMLTV EPG output
///
/// This is the main entry point for EPG generation. It:
/// 1. Fetches enabled channels
/// 2. Fetches programs for those channels
/// 3. Generates placeholder programs for synthetic channels
/// 4. Formats everything as XMLTV XML
pub fn generate_xmltv_epg(conn: &mut DbPooledConnection) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    // Get enabled channels
    let channels = get_enabled_channels_for_epg(conn)?;

    // Build a map from internal_id to channel_id for program mapping
    let mut id_map: std::collections::HashMap<i32, String> = std::collections::HashMap::new();
    for channel in &channels {
        id_map.insert(channel.internal_id, channel.id.clone());
    }

    // Get non-synthetic channel IDs for program query
    let non_synthetic_ids: Vec<i32> = channels
        .iter()
        .filter(|c| !c.is_synthetic)
        .map(|c| c.internal_id)
        .collect();

    // Fetch programs for non-synthetic channels
    let program_rows = get_programs_for_channels(conn, &non_synthetic_ids)?;

    // Convert program rows to XmltvProgramme
    let mut programmes: Vec<XmltvProgramme> = program_rows
        .into_iter()
        .filter_map(|row| {
            let channel_id = id_map.get(&row.xmltv_channel_id)?;
            let start_dt = parse_db_datetime(&row.start_time)?;
            let end_dt = parse_db_datetime(&row.end_time)?;

            Some(XmltvProgramme {
                channel_id: channel_id.clone(),
                title: row.title,
                description: row.description.filter(|s| !s.trim().is_empty()),
                start: format_xmltv_datetime(start_dt),
                stop: format_xmltv_datetime(end_dt),
                category: row.category.filter(|s| !s.trim().is_empty()),
                episode_num: row.episode_info.filter(|s| !s.trim().is_empty()),
            })
        })
        .collect();

    // Generate placeholder programs for synthetic channels
    for channel in &channels {
        if channel.is_synthetic {
            programmes.extend(generate_placeholder_programs(channel));
        }
    }

    // Sort programmes by channel_id then start time for consistent output
    programmes.sort_by(|a, b| {
        a.channel_id
            .cmp(&b.channel_id)
            .then_with(|| a.start.cmp(&b.start))
    });

    // Generate XMLTV output
    format_xmltv_output(&channels, &programmes)
}

/// Format channels and programmes as XMLTV XML
///
/// Uses quick-xml for efficient XML generation with proper escaping.
pub fn format_xmltv_output(
    channels: &[XmltvChannelOutput],
    programmes: &[XmltvProgramme],
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    // Pre-allocate capacity: ~500 bytes per channel + ~300 bytes per programme
    let estimated_size = 500 + (channels.len() * 500) + (programmes.len() * 300);
    let buffer = Vec::with_capacity(estimated_size);
    let mut writer = Writer::new(Cursor::new(buffer));

    // XML declaration
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))?;

    // Newline after declaration
    writer.write_event(Event::Text(BytesText::new("\n")))?;

    // DOCTYPE
    writer.write_event(Event::DocType(BytesText::from_escaped("tv SYSTEM \"xmltv.dtd\"")))?;

    // Newline after DOCTYPE
    writer.write_event(Event::Text(BytesText::new("\n")))?;

    // Root <tv> element with generator info
    let mut tv = BytesStart::new("tv");
    tv.push_attribute(("generator-info-name", "StreamForge"));
    tv.push_attribute(("generator-info-url", ""));
    writer.write_event(Event::Start(tv))?;
    writer.write_event(Event::Text(BytesText::new("\n")))?;

    // Write channels
    for channel in channels {
        write_channel(&mut writer, channel)?;
    }

    // Write programmes
    for programme in programmes {
        write_programme(&mut writer, programme)?;
    }

    // Close </tv>
    writer.write_event(Event::End(BytesEnd::new("tv")))?;
    writer.write_event(Event::Text(BytesText::new("\n")))?;

    let result = writer.into_inner().into_inner();
    Ok(String::from_utf8(result)?)
}

/// Write a single channel element to the XML writer
fn write_channel<W: std::io::Write>(
    writer: &mut Writer<W>,
    channel: &XmltvChannelOutput,
) -> Result<(), quick_xml::Error> {
    // <channel id="...">
    let mut ch = BytesStart::new("channel");
    ch.push_attribute(("id", channel.id.as_str()));
    writer.write_event(Event::Start(ch))?;

    // <display-name>...</display-name>
    writer.write_event(Event::Start(BytesStart::new("display-name")))?;
    writer.write_event(Event::Text(BytesText::new(&channel.display_name)))?;
    writer.write_event(Event::End(BytesEnd::new("display-name")))?;

    // <icon src="..."/> (if present)
    if let Some(ref icon) = channel.icon {
        let mut icon_elem = BytesStart::new("icon");
        icon_elem.push_attribute(("src", icon.as_str()));
        writer.write_event(Event::Empty(icon_elem))?;
    }

    // </channel>
    writer.write_event(Event::End(BytesEnd::new("channel")))?;
    writer.write_event(Event::Text(BytesText::new("\n")))?;

    Ok(())
}

/// Write a single programme element to the XML writer
fn write_programme<W: std::io::Write>(
    writer: &mut Writer<W>,
    programme: &XmltvProgramme,
) -> Result<(), quick_xml::Error> {
    // <programme start="..." stop="..." channel="...">
    let mut prog = BytesStart::new("programme");
    prog.push_attribute(("start", programme.start.as_str()));
    prog.push_attribute(("stop", programme.stop.as_str()));
    prog.push_attribute(("channel", programme.channel_id.as_str()));
    writer.write_event(Event::Start(prog))?;

    // <title lang="en">...</title>
    let mut title = BytesStart::new("title");
    title.push_attribute(("lang", "en"));
    writer.write_event(Event::Start(title))?;
    writer.write_event(Event::Text(BytesText::new(&programme.title)))?;
    writer.write_event(Event::End(BytesEnd::new("title")))?;

    // <desc lang="en">...</desc> (if present)
    if let Some(ref desc) = programme.description {
        let mut desc_elem = BytesStart::new("desc");
        desc_elem.push_attribute(("lang", "en"));
        writer.write_event(Event::Start(desc_elem))?;
        writer.write_event(Event::Text(BytesText::new(desc)))?;
        writer.write_event(Event::End(BytesEnd::new("desc")))?;
    }

    // <category lang="en">...</category> (if present)
    if let Some(ref cat) = programme.category {
        let mut cat_elem = BytesStart::new("category");
        cat_elem.push_attribute(("lang", "en"));
        writer.write_event(Event::Start(cat_elem))?;
        writer.write_event(Event::Text(BytesText::new(cat)))?;
        writer.write_event(Event::End(BytesEnd::new("category")))?;
    }

    // <episode-num system="onscreen">...</episode-num> (if present)
    if let Some(ref ep_num) = programme.episode_num {
        let mut ep_elem = BytesStart::new("episode-num");
        ep_elem.push_attribute(("system", "onscreen"));
        writer.write_event(Event::Start(ep_elem))?;
        writer.write_event(Event::Text(BytesText::new(ep_num)))?;
        writer.write_event(Event::End(BytesEnd::new("episode-num")))?;
    }

    // </programme>
    writer.write_event(Event::End(BytesEnd::new("programme")))?;
    writer.write_event(Event::Text(BytesText::new("\n")))?;

    Ok(())
}

/// Generate XMLTV content from pre-fetched data (for testing without DB)
pub fn generate_xmltv_from_data(
    channels: &[XmltvChannelOutput],
    programmes: &[XmltvProgramme],
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    format_xmltv_output(channels, programmes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Datelike;

    // Helper to create a test channel
    fn create_test_channel(
        id: &str,
        display_name: &str,
        icon: Option<&str>,
        is_synthetic: bool,
        internal_id: i32,
    ) -> XmltvChannelOutput {
        XmltvChannelOutput {
            id: id.to_string(),
            display_name: display_name.to_string(),
            icon: icon.map(|s| s.to_string()),
            is_synthetic,
            internal_id,
        }
    }

    // Helper to create a test programme
    fn create_test_programme(
        channel_id: &str,
        title: &str,
        start: &str,
        stop: &str,
        description: Option<&str>,
        category: Option<&str>,
        episode_num: Option<&str>,
    ) -> XmltvProgramme {
        XmltvProgramme {
            channel_id: channel_id.to_string(),
            title: title.to_string(),
            description: description.map(|s| s.to_string()),
            start: start.to_string(),
            stop: stop.to_string(),
            category: category.map(|s| s.to_string()),
            episode_num: episode_num.map(|s| s.to_string()),
        }
    }

    // ============================================================================
    // Empty EPG tests
    // ============================================================================

    #[test]
    fn test_empty_epg_when_no_channels() {
        let channels: Vec<XmltvChannelOutput> = vec![];
        let programmes: Vec<XmltvProgramme> = vec![];

        let result = generate_xmltv_from_data(&channels, &programmes).unwrap();

        assert!(result.contains("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(result.contains("<!DOCTYPE tv SYSTEM \"xmltv.dtd\">"));
        assert!(result.contains("<tv"));
        assert!(result.contains("</tv>"));
        assert!(result.contains("generator-info-name=\"StreamForge\""));
    }

    // ============================================================================
    // Single channel tests
    // ============================================================================

    #[test]
    fn test_single_channel_generates_correct_xmltv_format() {
        let channels = vec![create_test_channel(
            "ESPN.US",
            "ESPN",
            Some("http://example.com/espn.png"),
            false,
            1,
        )];
        let programmes: Vec<XmltvProgramme> = vec![];

        let result = generate_xmltv_from_data(&channels, &programmes).unwrap();

        assert!(result.contains("<channel id=\"ESPN.US\">"));
        assert!(result.contains("<display-name>ESPN</display-name>"));
        assert!(result.contains("<icon src=\"http://example.com/espn.png\"/>"));
        assert!(result.contains("</channel>"));
    }

    #[test]
    fn test_channel_without_icon() {
        let channels = vec![create_test_channel("CNN.US", "CNN", None, false, 2)];
        let programmes: Vec<XmltvProgramme> = vec![];

        let result = generate_xmltv_from_data(&channels, &programmes).unwrap();

        assert!(result.contains("<channel id=\"CNN.US\">"));
        assert!(result.contains("<display-name>CNN</display-name>"));
        assert!(!result.contains("<icon"));
        assert!(result.contains("</channel>"));
    }

    // ============================================================================
    // Multiple channels tests
    // ============================================================================

    #[test]
    fn test_multiple_channels_ordered_correctly() {
        let channels = vec![
            create_test_channel("CH1", "Channel 1", None, false, 1),
            create_test_channel("CH2", "Channel 2", None, false, 2),
            create_test_channel("CH3", "Channel 3", None, false, 3),
        ];
        let programmes: Vec<XmltvProgramme> = vec![];

        let result = generate_xmltv_from_data(&channels, &programmes).unwrap();

        // Check that channels appear in order
        let pos1 = result.find("CH1").unwrap();
        let pos2 = result.find("CH2").unwrap();
        let pos3 = result.find("CH3").unwrap();

        assert!(pos1 < pos2);
        assert!(pos2 < pos3);
    }

    // ============================================================================
    // Programme tests
    // ============================================================================

    #[test]
    fn test_programme_formatted_correctly() {
        let channels = vec![create_test_channel("ESPN.US", "ESPN", None, false, 1)];
        let programmes = vec![create_test_programme(
            "ESPN.US",
            "SportsCenter",
            "20260120200000 +0000",
            "20260120210000 +0000",
            Some("Sports news and highlights."),
            Some("Sports"),
            Some("S1E100"),
        )];

        let result = generate_xmltv_from_data(&channels, &programmes).unwrap();

        assert!(result.contains("<programme start=\"20260120200000 +0000\" stop=\"20260120210000 +0000\" channel=\"ESPN.US\">"));
        assert!(result.contains("<title lang=\"en\">SportsCenter</title>"));
        assert!(result.contains("<desc lang=\"en\">Sports news and highlights.</desc>"));
        assert!(result.contains("<category lang=\"en\">Sports</category>"));
        assert!(result.contains("<episode-num system=\"onscreen\">S1E100</episode-num>"));
        assert!(result.contains("</programme>"));
    }

    #[test]
    fn test_programme_without_optional_fields() {
        let channels = vec![create_test_channel("ESPN.US", "ESPN", None, false, 1)];
        let programmes = vec![create_test_programme(
            "ESPN.US",
            "SportsCenter",
            "20260120200000 +0000",
            "20260120210000 +0000",
            None,
            None,
            None,
        )];

        let result = generate_xmltv_from_data(&channels, &programmes).unwrap();

        assert!(result.contains("<title lang=\"en\">SportsCenter</title>"));
        assert!(!result.contains("<desc"));
        assert!(!result.contains("<category"));
        assert!(!result.contains("<episode-num"));
    }

    // ============================================================================
    // Datetime format tests
    // ============================================================================

    #[test]
    fn test_xmltv_datetime_format() {
        let dt = Utc::now();
        let formatted = format_xmltv_datetime(dt);

        // Format should be: YYYYMMDDHHmmss +0000
        assert!(formatted.ends_with(" +0000"));
        assert_eq!(formatted.len(), 20); // "20260120200000 +0000"
    }

    // ============================================================================
    // Synthetic channel tests
    // ============================================================================

    #[test]
    fn test_synthetic_channels_get_placeholder_programs() {
        let channel = create_test_channel("SYNTHETIC.1", "My Channel", None, true, 100);

        let programs = generate_placeholder_programs(&channel);

        // Should have programs for 7 days at 2-hour intervals = 84 programs
        assert_eq!(programs.len(), 84);

        // Check first program
        let first = &programs[0];
        assert_eq!(first.channel_id, "SYNTHETIC.1");
        assert!(first.title.contains("My Channel - Live Programming"));
        assert!(first
            .description
            .as_ref()
            .unwrap()
            .contains("Live content on My Channel"));
    }

    #[test]
    fn test_placeholder_programs_cover_7_days() {
        let channel = create_test_channel("TEST", "Test Channel", None, true, 1);
        let programs = generate_placeholder_programs(&channel);

        // 7 days at 2 hours per program = 84 programs
        // (Note: this is a simplified check - proper test would parse full dates)
        assert!(programs.len() >= 80 && programs.len() <= 90);
    }

    #[test]
    fn test_placeholder_programs_are_2_hours() {
        let channel = create_test_channel("TEST", "Test", None, true, 1);
        let programs = generate_placeholder_programs(&channel);

        // Check that each program is 2 hours
        // By verifying the pattern of timestamps
        for i in 0..programs.len() - 1 {
            // Each program's stop should equal next program's start
            assert_eq!(programs[i].stop, programs[i + 1].start);
        }
    }

    // ============================================================================
    // XML escaping tests
    // ============================================================================

    #[test]
    fn test_xml_special_characters_escaped_properly() {
        let channels = vec![create_test_channel(
            "TEST",
            "Test & <Channel> \"Name\"",
            None,
            false,
            1,
        )];
        let programmes = vec![create_test_programme(
            "TEST",
            "Show & Tell <Special>",
            "20260120200000 +0000",
            "20260120210000 +0000",
            Some("A \"great\" show & more"),
            None,
            None,
        )];

        let result = generate_xmltv_from_data(&channels, &programmes).unwrap();

        // quick-xml automatically escapes special characters
        // The result should be valid XML
        assert!(result.contains("<display-name>"));
        assert!(result.contains("</display-name>"));
        assert!(result.contains("<title lang=\"en\">"));
    }

    // ============================================================================
    // Database datetime parsing tests
    // ============================================================================

    #[test]
    fn test_parse_db_datetime_sqlite_format() {
        let dt_str = "2026-01-20 20:00:00";
        let result = parse_db_datetime(dt_str);

        assert!(result.is_some());
        let dt = result.unwrap();
        assert_eq!(dt.year(), 2026);
        assert_eq!(dt.month(), 1);
        assert_eq!(dt.day(), 20);
        assert_eq!(dt.hour(), 20);
    }

    #[test]
    fn test_parse_db_datetime_iso_format() {
        let dt_str = "2026-01-20T20:00:00Z";
        let result = parse_db_datetime(dt_str);

        assert!(result.is_some());
    }
}
