//! XMLTV Channel Display Commands
//!
//! Tauri commands for displaying XMLTV channels with their matched Xtream streams.
//! Story 3-2: Display XMLTV Channel List with Match Status
//! Story 3-8: Manage Orphan Xtream Channels

mod mappings;
mod queries;
// TODO: mod orphans;
// TODO: mod toggles;

// Re-export shared types from crate::types
pub use crate::types::{
    build_stream_match, parse_qualities, AcestreamMatch, AllChannelMappings, M3uStreamMatch,
    TargetLineupChannel, XmltvChannelWithMappings, XmltvSourceChannel, XtreamStreamMatch,
    XtreamStreamSearchResult, SYNTHETIC_SOURCE_ID,
};

// Re-export all public commands
pub use mappings::{
    add_acestream_channel_mapping, add_m3u_channel_mapping, add_manual_stream_mapping,
    get_all_channel_mappings, get_all_xtream_streams, remove_stream_mapping,
    search_xtream_streams, set_primary_stream,
};
// TODO: re-export orphans and toggles once those modules are created
pub use queries::{
    get_target_lineup_channels, get_xmltv_channels_for_source,
    get_xmltv_channels_with_mappings,
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
