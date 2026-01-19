//! Channel Matcher Module
//!
//! Provides fuzzy matching between XMLTV channels and Xtream streams.
//! This follows the XMLTV-first architecture where XMLTV channels define
//! the Plex lineup and Xtream streams are matched TO them as video sources.
//!
//! # Architecture
//!
//! - XMLTV channels are the PRIMARY channel list for Plex
//! - One XMLTV channel can map to MULTIPLE Xtream streams (failover)
//! - Highest confidence match is marked as `is_primary = true`
//!
//! # Modules
//!
//! - `fuzzy`: Core fuzzy matching algorithm
//! - `scorer`: Match confidence scoring with boosts
//! - `persistence`: Database operations for saving/loading mappings
//! - `auto_rematch`: Change detection and automatic rematch

mod auto_rematch;
mod fuzzy;
mod persistence;
mod scorer;

pub use auto_rematch::*;
pub use fuzzy::*;
pub use persistence::*;
pub use scorer::*;

use serde::{Deserialize, Serialize};

/// Configuration for the matching algorithm
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchConfig {
    /// Minimum confidence threshold for matches (default: 0.85)
    pub threshold: f64,
    /// Boost applied when EPG IDs match exactly (default: 0.15)
    pub epg_id_boost: f64,
    /// Boost applied when normalized names match exactly (default: 0.10)
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

/// The type of match that was found
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchType {
    /// EPG channel ID matches XMLTV channel ID exactly
    ExactEpgId,
    /// Normalized names match exactly
    ExactName,
    /// Jaro-Winkler fuzzy match above threshold
    Fuzzy,
    /// No match found (below threshold)
    None,
}

/// Result of matching a single XMLTV channel to Xtream streams
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

/// Statistics about a matching operation
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchStats {
    /// Total number of XMLTV channels processed
    pub total_xmltv: usize,
    /// Total number of Xtream channels available
    pub total_xtream: usize,
    /// Number of XMLTV channels with at least one match
    pub matched: usize,
    /// Number of XMLTV channels with no matches
    pub unmatched: usize,
    /// Number of XMLTV channels with multiple matches (failover available)
    pub multiple_matches: usize,
    /// Duration of the matching operation in milliseconds
    pub duration_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_config_default() {
        let config = MatchConfig::default();
        assert!((config.threshold - 0.85).abs() < f64::EPSILON);
        assert!((config.epg_id_boost - 0.15).abs() < f64::EPSILON);
        assert!((config.exact_name_boost - 0.10).abs() < f64::EPSILON);
    }

    #[test]
    fn test_match_config_with_threshold() {
        let config = MatchConfig::default().with_threshold(0.90);
        assert!((config.threshold - 0.90).abs() < f64::EPSILON);
    }

    #[test]
    fn test_match_result_with_priority() {
        let result = MatchResult::new(1, 100, 0.95, MatchType::Fuzzy).with_priority(true, 0);
        assert!(result.is_primary);
        assert_eq!(result.stream_priority, 0);
    }
}
