//! Channel Matcher Module

mod auto_rematch;
mod fuzzy;
mod persistence;
mod scorer;

pub use auto_rematch::*;
pub use fuzzy::{
    basic_normalize, epg_ids_match, match_channels, match_channels_with_rules, match_m3u_channels,
    match_m3u_channels_with_rules, normalize_channel_name, normalize_with_rules, M3uMatchResult,
};
pub use persistence::*;
pub use scorer::*;

use serde::{Deserialize, Serialize};

/// Configuration for the matching algorithm
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchConfig {
    pub threshold: f64,
    pub epg_id_boost: f64,
    pub exact_name_boost: f64,
}

impl Default for MatchConfig {
    fn default() -> Self {
        Self {
            threshold: 0.85,
            epg_id_boost: 0.15,
            exact_name_boost: 0.10,
        }
    }
}

impl MatchConfig {
    pub fn with_threshold(mut self, threshold: f64) -> Self {
        self.threshold = threshold;
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchType {
    ExactEpgId,
    ExactName,
    Fuzzy,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchResult {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: i32,
    pub confidence: f64,
    pub is_primary: bool,
    pub stream_priority: i32,
    pub match_type: MatchType,
}

impl MatchResult {
    pub fn new(
        xmltv_channel_id: i32,
        xtream_channel_id: i32,
        confidence: f64,
        match_type: MatchType,
    ) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id,
            confidence,
            is_primary: false,
            stream_priority: 0,
            match_type,
        }
    }

    pub fn with_priority(mut self, is_primary: bool, stream_priority: i32) -> Self {
        self.is_primary = is_primary;
        self.stream_priority = stream_priority;
        self
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchStats {
    pub total_xmltv: usize,
    pub total_source_channels: usize,
    pub matched: usize,
    pub unmatched: usize,
    pub multiple_matches: usize,
    pub duration_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_config_default() {
        let config = MatchConfig::default();
        assert!((config.threshold - 0.85).abs() < f64::EPSILON);
    }

    #[test]
    fn test_match_result_with_priority() {
        let result = MatchResult::new(1, 100, 0.95, MatchType::Fuzzy).with_priority(true, 0);
        assert!(result.is_primary);
        assert_eq!(result.stream_priority, 0);
    }
}
