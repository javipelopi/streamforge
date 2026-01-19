//! XMLTV streaming parser using quick-xml
//!
//! Implements a memory-efficient streaming parser for XMLTV format files.

use std::collections::HashMap;

use chrono::{DateTime, FixedOffset, NaiveDateTime, TimeZone, Utc};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;

use super::types::{ParsedChannel, ParsedProgram, XmltvError};

/// Parse XMLTV data from bytes
///
/// Returns a tuple of (channels, programs) parsed from the XMLTV data.
/// Uses streaming parser for memory efficiency with large files.
/// Deduplicates channels by channel_id (keeps first occurrence).
pub fn parse_xmltv_data(data: &[u8]) -> Result<(Vec<ParsedChannel>, Vec<ParsedProgram>), XmltvError> {
    let mut reader = Reader::from_reader(data);
    reader.config_mut().trim_text(true);

    // Use HashMap to deduplicate channels by channel_id
    let mut channels_map: HashMap<String, ParsedChannel> = HashMap::new();
    let mut programs = Vec::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"channel" => {
                    let channel = parse_channel(&mut reader, &e)?;
                    // Only insert if channel_id not already present (keep first)
                    channels_map.entry(channel.channel_id.clone()).or_insert(channel);
                }
                b"programme" => {
                    let program = parse_program(&mut reader, &e)?;
                    programs.push(program);
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(XmltvError::ParseError(format!(
                    "XML parse error at position {}: {}",
                    reader.buffer_position(),
                    e
                )))
            }
            _ => {}
        }
        buf.clear();
    }

    // Convert HashMap to Vec and sort by channel_id for deterministic ordering
    let mut channels: Vec<ParsedChannel> = channels_map.into_values().collect();
    channels.sort_by(|a, b| a.channel_id.cmp(&b.channel_id));

    Ok((channels, programs))
}

/// Parse a <channel> element
fn parse_channel(
    reader: &mut Reader<&[u8]>,
    start: &BytesStart,
) -> Result<ParsedChannel, XmltvError> {
    // Extract channel id from attributes
    let channel_id = get_attribute(start, b"id")
        .ok_or_else(|| XmltvError::ParseError("Channel missing id attribute".into()))?;

    let mut display_name: Option<String> = None;
    let mut icon: Option<String> = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => match e.name().as_ref() {
                b"display-name" => {
                    if display_name.is_none() {
                        // Read the text content
                        display_name = Some(read_element_text(reader)?);
                    }
                }
                b"icon" => {
                    icon = get_attribute(&e, b"src");
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"channel" => break,
            Ok(Event::Eof) => {
                return Err(XmltvError::ParseError(
                    "Unexpected EOF while parsing channel".into(),
                ))
            }
            Err(e) => return Err(XmltvError::ParseError(e.to_string())),
            _ => {}
        }
        buf.clear();
    }

    let display_name =
        display_name.ok_or_else(|| XmltvError::ParseError("Channel missing display-name".into()))?;

    Ok(ParsedChannel {
        channel_id,
        display_name,
        icon,
    })
}

/// Parse a <programme> element
fn parse_program(
    reader: &mut Reader<&[u8]>,
    start: &BytesStart,
) -> Result<ParsedProgram, XmltvError> {
    // Extract attributes
    let channel_id = get_attribute(start, b"channel")
        .ok_or_else(|| XmltvError::ParseError("Programme missing channel attribute".into()))?;

    let start_str = get_attribute(start, b"start")
        .ok_or_else(|| XmltvError::ParseError("Programme missing start attribute".into()))?;

    let stop_str = get_attribute(start, b"stop")
        .ok_or_else(|| XmltvError::ParseError("Programme missing stop attribute".into()))?;

    // Parse timestamps to ISO 8601
    let start_time = parse_xmltv_timestamp(&start_str)?;
    let end_time = parse_xmltv_timestamp(&stop_str)?;

    let mut title: Option<String> = None;
    let mut description: Option<String> = None;
    let mut category: Option<String> = None;
    let mut episode_info: Option<String> = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"title" => {
                    if title.is_none() {
                        title = Some(read_element_text(reader)?);
                    }
                }
                b"desc" => {
                    if description.is_none() {
                        description = Some(read_element_text(reader)?);
                    }
                }
                b"category" => {
                    if category.is_none() {
                        category = Some(read_element_text(reader)?);
                    }
                }
                b"episode-num" => {
                    if episode_info.is_none() {
                        episode_info = Some(read_element_text(reader)?);
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"programme" => break,
            Ok(Event::Eof) => {
                return Err(XmltvError::ParseError(
                    "Unexpected EOF while parsing programme".into(),
                ))
            }
            Err(e) => return Err(XmltvError::ParseError(e.to_string())),
            _ => {}
        }
        buf.clear();
    }

    let title =
        title.ok_or_else(|| XmltvError::ParseError("Programme missing title".into()))?;

    Ok(ParsedProgram {
        channel_id,
        title,
        description,
        start_time,
        end_time,
        category,
        episode_info,
    })
}

/// Parse XMLTV timestamp format to ISO 8601 UTC string
///
/// XMLTV format: YYYYMMDDhhmmss ±HHMM (e.g., "20260119120000 +0000")
pub fn parse_xmltv_timestamp(s: &str) -> Result<String, XmltvError> {
    let s = s.trim();
    let parts: Vec<&str> = s.split_whitespace().collect();

    if parts.is_empty() {
        return Err(XmltvError::TimestampError(format!(
            "Empty timestamp: '{}'",
            s
        )));
    }

    // Parse the datetime part (YYYYMMDDhhmmss)
    let datetime_str = parts[0];
    let naive = NaiveDateTime::parse_from_str(datetime_str, "%Y%m%d%H%M%S").map_err(|e| {
        XmltvError::TimestampError(format!("Invalid datetime '{}': {}", datetime_str, e))
    })?;

    // Parse timezone offset if present
    let datetime_utc = if parts.len() > 1 {
        let offset_str = parts[1];
        let offset = parse_timezone_offset(offset_str)?;
        // The naive datetime represents LOCAL time in the given timezone
        // We need to create a datetime with that offset, then convert to UTC
        let datetime_local = offset.from_local_datetime(&naive).single()
            .ok_or_else(|| XmltvError::TimestampError("Ambiguous or invalid local time".into()))?;
        datetime_local.with_timezone(&Utc)
    } else {
        // Assume UTC if no offset
        DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc)
    };

    Ok(datetime_utc.format("%Y-%m-%dT%H:%M:%SZ").to_string())
}

/// Parse timezone offset string (±HHMM) to FixedOffset
fn parse_timezone_offset(s: &str) -> Result<FixedOffset, XmltvError> {
    if s.len() < 5 {
        return Err(XmltvError::TimestampError(format!(
            "Invalid timezone offset: '{}'",
            s
        )));
    }

    let sign = match &s[0..1] {
        "+" => 1,
        "-" => -1,
        _ => {
            return Err(XmltvError::TimestampError(format!(
                "Invalid timezone sign: '{}'",
                s
            )))
        }
    };

    let hours: i32 = s[1..3].parse().map_err(|_| {
        XmltvError::TimestampError(format!("Invalid timezone hours: '{}'", &s[1..3]))
    })?;

    let minutes: i32 = s[3..5].parse().map_err(|_| {
        XmltvError::TimestampError(format!("Invalid timezone minutes: '{}'", &s[3..5]))
    })?;

    let total_secs = sign * (hours * 3600 + minutes * 60);

    FixedOffset::east_opt(total_secs).ok_or_else(|| {
        XmltvError::TimestampError(format!("Invalid timezone offset seconds: {}", total_secs))
    })
}

/// Get an attribute value from an element
fn get_attribute(element: &BytesStart, attr_name: &[u8]) -> Option<String> {
    element
        .attributes()
        .filter_map(|a| a.ok())
        .find(|a| a.key.as_ref() == attr_name)
        .and_then(|a| String::from_utf8(a.value.into_owned()).ok())
}

/// Read the text content of the current element
fn read_element_text(reader: &mut Reader<&[u8]>) -> Result<String, XmltvError> {
    let mut text = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Text(e)) => {
                text.push_str(
                    &e.unescape()
                        .map_err(|e| XmltvError::ParseError(e.to_string()))?,
                );
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => {
                return Err(XmltvError::ParseError(
                    "Unexpected EOF while reading element text".into(),
                ))
            }
            Err(e) => return Err(XmltvError::ParseError(e.to_string())),
            _ => {}
        }
        buf.clear();
    }

    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_xmltv_timestamp_with_utc() {
        let result = parse_xmltv_timestamp("20260119120000 +0000").unwrap();
        assert_eq!(result, "2026-01-19T12:00:00Z");
    }

    #[test]
    fn test_parse_xmltv_timestamp_with_positive_offset() {
        // +0100 means the local time is 1 hour ahead of UTC
        // So 13:00 +0100 = 12:00 UTC
        let result = parse_xmltv_timestamp("20260119130000 +0100").unwrap();
        assert_eq!(result, "2026-01-19T12:00:00Z");
    }

    #[test]
    fn test_parse_xmltv_timestamp_with_negative_offset() {
        // -0500 means the local time is 5 hours behind UTC
        // So 07:00 -0500 = 12:00 UTC
        let result = parse_xmltv_timestamp("20260119070000 -0500").unwrap();
        assert_eq!(result, "2026-01-19T12:00:00Z");
    }

    #[test]
    fn test_parse_xmltv_timestamp_invalid() {
        assert!(parse_xmltv_timestamp("invalid").is_err());
        assert!(parse_xmltv_timestamp("").is_err());
    }

    #[test]
    fn test_parse_minimal_xmltv() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="test.1">
    <display-name>Test Channel</display-name>
  </channel>
  <programme start="20260119120000 +0000" stop="20260119130000 +0000" channel="test.1">
    <title>Test Program</title>
  </programme>
</tv>"#;

        let (channels, programs) = parse_xmltv_data(xml.as_bytes()).unwrap();

        assert_eq!(channels.len(), 1);
        assert_eq!(channels[0].channel_id, "test.1");
        assert_eq!(channels[0].display_name, "Test Channel");
        assert!(channels[0].icon.is_none());

        assert_eq!(programs.len(), 1);
        assert_eq!(programs[0].channel_id, "test.1");
        assert_eq!(programs[0].title, "Test Program");
        assert_eq!(programs[0].start_time, "2026-01-19T12:00:00Z");
        assert_eq!(programs[0].end_time, "2026-01-19T13:00:00Z");
    }

    #[test]
    fn test_parse_full_xmltv() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="bbc-one.uk">
    <display-name>BBC One</display-name>
    <display-name>BBC 1</display-name>
    <icon src="https://example.com/bbc-logo.png"/>
  </channel>
  <programme start="20260119120000 +0000" stop="20260119130000 +0000" channel="bbc-one.uk">
    <title lang="en">Breaking News</title>
    <desc lang="en">Latest breaking news coverage</desc>
    <category lang="en">News</category>
    <episode-num system="xmltv_ns">1.5.0/1</episode-num>
  </programme>
</tv>"#;

        let (channels, programs) = parse_xmltv_data(xml.as_bytes()).unwrap();

        assert_eq!(channels.len(), 1);
        assert_eq!(channels[0].channel_id, "bbc-one.uk");
        assert_eq!(channels[0].display_name, "BBC One"); // First display-name
        assert_eq!(
            channels[0].icon,
            Some("https://example.com/bbc-logo.png".into())
        );

        assert_eq!(programs.len(), 1);
        assert_eq!(programs[0].title, "Breaking News");
        assert_eq!(
            programs[0].description,
            Some("Latest breaking news coverage".into())
        );
        assert_eq!(programs[0].category, Some("News".into()));
        assert_eq!(programs[0].episode_info, Some("1.5.0/1".into()));
    }

    #[test]
    fn test_gzip_detection() {
        // Gzip magic bytes: 0x1f 0x8b
        let gzip_data = vec![0x1f, 0x8b, 0x08, 0x00];
        assert!(detect_gzip(&gzip_data));

        let plain_data = b"<?xml version";
        assert!(!detect_gzip(plain_data));
    }

    #[test]
    fn test_duplicate_channels_deduplicated() {
        // XMLTV file with duplicate channel IDs - should keep only first occurrence
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="duplicate.1">
    <display-name>First Channel</display-name>
  </channel>
  <channel id="duplicate.1">
    <display-name>Duplicate Channel</display-name>
  </channel>
  <channel id="unique.2">
    <display-name>Unique Channel</display-name>
  </channel>
  <programme start="20260119120000 +0000" stop="20260119130000 +0000" channel="duplicate.1">
    <title>Test Program</title>
  </programme>
</tv>"#;

        let (channels, programs) = parse_xmltv_data(xml.as_bytes()).unwrap();

        // Should only have 2 unique channels, not 3
        assert_eq!(channels.len(), 2);

        // Channels are sorted by channel_id for deterministic ordering
        // So "duplicate.1" comes before "unique.2"
        assert_eq!(channels[0].channel_id, "duplicate.1");
        assert_eq!(channels[1].channel_id, "unique.2");

        // Verify the FIRST occurrence was kept (not the duplicate)
        assert_eq!(
            channels[0].display_name,
            "First Channel",
            "Should keep first channel occurrence, not duplicate"
        );
        assert_eq!(channels[1].display_name, "Unique Channel");

        // Verify programs still parse correctly
        assert_eq!(programs.len(), 1);
        assert_eq!(programs[0].channel_id, "duplicate.1");
    }
}

/// Detect if data is gzip compressed by checking magic bytes
pub fn detect_gzip(data: &[u8]) -> bool {
    data.len() >= 2 && data[0] == 0x1f && data[1] == 0x8b
}
