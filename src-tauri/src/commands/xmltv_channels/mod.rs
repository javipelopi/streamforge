//! XMLTV Channel Display Commands
//!
//! Tauri commands for displaying XMLTV channels with their matched Xtream streams.
//! Story 3-2: Display XMLTV Channel List with Match Status
//! Story 3-8: Manage Orphan Xtream Channels

mod mappings;
mod queries;
// TODO: mod orphans;
// TODO: mod toggles;

use serde::Serialize;

use crate::db::models::{ChannelMapping, XtreamChannel};

/// Source ID marker for synthetic XMLTV channels (promoted orphans)
pub(crate) const SYNTHETIC_SOURCE_ID: i32 = -1;

/// Xtream stream match info for display
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XtreamStreamMatch {
    pub id: i32,
    pub mapping_id: i32,
    pub name: String,
    pub stream_icon: Option<String>,
    pub qualities: Vec<String>,
    pub match_confidence: f64,
    pub is_primary: bool,
    pub is_manual: bool,
    pub stream_priority: i32,
    /// True if this is a manual match pointing to a stream that no longer exists
    pub is_orphaned: bool,
}

/// XMLTV channel with all mapping info for display
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XmltvChannelWithMappings {
    pub id: i32,
    pub source_id: i32,
    pub channel_id: String,
    pub display_name: String,
    pub icon: Option<String>,
    pub is_synthetic: bool,
    // Settings
    pub is_enabled: bool,
    pub plex_display_order: Option<i32>,
    // Matches
    pub match_count: i32,
    pub matches: Vec<XtreamStreamMatch>,
}

/// Parse qualities string (JSON array or comma-separated) into Vec<String>
pub(crate) fn parse_qualities(qualities: &Option<String>) -> Vec<String> {
    match qualities {
        Some(q) if !q.is_empty() => {
            // Try parsing as JSON array first
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(q) {
                return parsed;
            }
            // Fall back to comma-separated
            q.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
        _ => Vec::new(),
    }
}

/// Build an XtreamStreamMatch from a mapping and stream.
/// Centralizes the construction to avoid code duplication across commands.
pub(crate) fn build_stream_match(mapping: &ChannelMapping, stream: &XtreamChannel) -> Option<XtreamStreamMatch> {
    Some(XtreamStreamMatch {
        id: stream.id?,
        mapping_id: mapping.id?,
        name: stream.name.clone(),
        stream_icon: stream.stream_icon.clone(),
        qualities: parse_qualities(&stream.qualities),
        match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
        is_primary: mapping.is_primary.unwrap_or(0) != 0,
        is_manual: mapping.is_manual.unwrap_or(0) != 0,
        stream_priority: mapping.stream_priority.unwrap_or(0),
        is_orphaned: false,
    })
}

// Re-export all public commands and types
pub use mappings::{
    add_acestream_channel_mapping, add_m3u_channel_mapping, add_manual_stream_mapping,
    get_all_channel_mappings, get_all_xtream_streams, remove_stream_mapping,
    search_xtream_streams, set_primary_stream,
    AcestreamMatch, AllChannelMappings, M3uStreamMatch, XtreamStreamSearchResult,
};
// TODO: re-export orphans and toggles once those modules are created
pub use queries::{
    get_target_lineup_channels, get_xmltv_channels_for_source,
    get_xmltv_channels_with_mappings,
    TargetLineupChannel, XmltvSourceChannel,
};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::matcher::normalize_channel_name;
    use strsim::jaro_winkler;

    #[test]
    fn test_parse_qualities_json() {
        let json_input = Some(r#"["HD", "SD", "4K"]"#.to_string());
        let result = parse_qualities(&json_input);
        assert_eq!(result, vec!["HD", "SD", "4K"]);
    }

    #[test]
    fn test_parse_qualities_comma_separated() {
        let csv_input = Some("HD, SD, 4K".to_string());
        let result = parse_qualities(&csv_input);
        assert_eq!(result, vec!["HD", "SD", "4K"]);
    }

    #[test]
    fn test_parse_qualities_empty() {
        assert_eq!(parse_qualities(&None), Vec::<String>::new());
        assert_eq!(parse_qualities(&Some("".to_string())), Vec::<String>::new());
    }

    #[test]
    fn test_normalization_helps_matching() {
        let query = normalize_channel_name("ESPN HD");
        let stream = normalize_channel_name("ESPN FHD");

        assert_eq!(query, "espn");
        assert_eq!(stream, "espn");

        let score = jaro_winkler(&query, &stream);
        assert!((score - 1.0).abs() < f64::EPSILON);
    }
}
