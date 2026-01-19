//! Fuzzy Matching Algorithm
//!
//! Provides the core fuzzy matching functionality for matching XMLTV channels
//! to Xtream streams. This module handles name normalization and the matching
//! algorithm itself.

use regex::Regex;
use std::sync::LazyLock;

use super::{scorer::calculate_match_score, MatchConfig, MatchResult, MatchStats, MatchType};
use crate::db::models::{XmltvChannel, XtreamChannel};

/// Regex pattern for removing quality suffixes (HD, SD, FHD, 4K, UHD, etc.)
/// Matches quality indicators both at end and before parentheses/punctuation
static QUALITY_SUFFIX_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\s*[-]?\s*(hd|sd|fhd|4k|uhd|1080p|720p|480p)(?:\s|$|\(|\))").unwrap()
});

/// Regex pattern for removing non-alphanumeric characters except spaces
static NON_ALNUM_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^a-z0-9\s]").unwrap());

/// Regex pattern for collapsing multiple spaces into single space
static MULTI_SPACE_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+").unwrap());

/// Normalize a channel name for matching.
///
/// Normalization steps:
/// 1. Convert to lowercase
/// 2. Remove HD/SD/FHD/4K/UHD suffixes
/// 3. Remove punctuation (keep alphanumeric and spaces)
/// 4. Collapse multiple spaces into single space
/// 5. Trim whitespace
///
/// # Arguments
///
/// * `name` - The channel name to normalize
///
/// # Returns
///
/// The normalized channel name
///
/// # Examples
///
/// ```
/// use iptv_lib::matcher::normalize_channel_name;
///
/// assert_eq!(normalize_channel_name("ESPN HD"), "espn");
/// assert_eq!(normalize_channel_name("ESPN FHD"), "espn");
/// assert_eq!(normalize_channel_name("ESPN - 4K"), "espn");
/// assert_eq!(normalize_channel_name("BBC One (UK)"), "bbc one uk");
/// assert_eq!(normalize_channel_name("CNN  News"), "cnn news");
/// ```
pub fn normalize_channel_name(name: &str) -> String {
    // Step 1: Convert to lowercase
    let lowered = name.to_lowercase();

    // Step 2: Remove quality suffixes (HD, SD, FHD, 4K, UHD, etc.)
    let without_suffix = QUALITY_SUFFIX_REGEX.replace_all(&lowered, "");

    // Step 3: Remove punctuation (keep alphanumeric and spaces)
    let without_punct = NON_ALNUM_REGEX.replace_all(&without_suffix, " ");

    // Step 4: Collapse multiple spaces into single space
    let collapsed = MULTI_SPACE_REGEX.replace_all(&without_punct, " ");

    // Step 5: Trim whitespace
    collapsed.trim().to_string()
}

/// Match XMLTV channels to Xtream streams using fuzzy matching.
///
/// For each XMLTV channel, this function finds all Xtream streams that match
/// above the confidence threshold. The matches are sorted by confidence score
/// (descending) and assigned priority accordingly.
///
/// # Arguments
///
/// * `xmltv_channels` - List of XMLTV channels to match
/// * `xtream_channels` - List of Xtream streams to match against
/// * `config` - Matching configuration (threshold, boosts)
///
/// # Returns
///
/// A tuple of (Vec<MatchResult>, MatchStats) containing all matches and statistics
pub fn match_channels(
    xmltv_channels: &[XmltvChannel],
    xtream_channels: &[XtreamChannel],
    config: &MatchConfig,
) -> (Vec<MatchResult>, MatchStats) {
    let start = std::time::Instant::now();
    let mut all_matches: Vec<MatchResult> = Vec::new();
    let mut stats = MatchStats {
        total_xmltv: xmltv_channels.len(),
        total_xtream: xtream_channels.len(),
        ..Default::default()
    };

    // Pre-normalize all Xtream channel names for efficiency
    let xtream_normalized: Vec<(i32, String, Option<&str>)> = xtream_channels
        .iter()
        .filter_map(|c| {
            c.id.map(|id| {
                (
                    id,
                    normalize_channel_name(&c.name),
                    c.epg_channel_id.as_deref(),
                )
            })
        })
        .collect();

    for xmltv in xmltv_channels {
        let xmltv_id = match xmltv.id {
            Some(id) => id,
            None => continue,
        };

        let xmltv_normalized = normalize_channel_name(&xmltv.display_name);
        let xmltv_channel_id = &xmltv.channel_id;

        let mut channel_matches: Vec<MatchResult> = Vec::new();

        for (xtream_id, xtream_normalized, xtream_epg_id) in &xtream_normalized {
            // Check for EPG ID match (Xtream's epg_channel_id matches XMLTV's channel_id)
            let epg_id_match = xtream_epg_id
                .map(|epg_id| epg_id == xmltv_channel_id)
                .unwrap_or(false);

            // Check for exact normalized name match
            let exact_name_match = xmltv_normalized == *xtream_normalized;

            // Calculate match score
            let score = calculate_match_score(
                &xmltv_normalized,
                xtream_normalized,
                epg_id_match,
                exact_name_match,
                config,
            );

            // Only include matches above threshold
            if score >= config.threshold {
                let match_type = if epg_id_match {
                    MatchType::ExactEpgId
                } else if exact_name_match {
                    MatchType::ExactName
                } else {
                    MatchType::Fuzzy
                };

                channel_matches.push(MatchResult::new(xmltv_id, *xtream_id, score, match_type));
            }
        }

        // Sort matches by confidence (descending)
        channel_matches.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

        // Assign priority and primary status
        let match_count = channel_matches.len();
        for (i, m) in channel_matches.iter_mut().enumerate() {
            m.is_primary = i == 0;
            m.stream_priority = i as i32;
        }

        // Update stats
        if match_count > 0 {
            stats.matched += 1;
            if match_count > 1 {
                stats.multiple_matches += 1;
            }
        } else {
            stats.unmatched += 1;
        }

        all_matches.extend(channel_matches);
    }

    stats.duration_ms = start.elapsed().as_millis() as u64;
    (all_matches, stats)
}

/// Check if an EPG ID from an Xtream channel matches an XMLTV channel ID.
///
/// This handles case-insensitive matching and trimming.
pub fn epg_ids_match(xtream_epg_id: Option<&str>, xmltv_channel_id: &str) -> bool {
    xtream_epg_id
        .map(|epg_id| epg_id.trim().eq_ignore_ascii_case(xmltv_channel_id.trim()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_removes_hd_suffix() {
        assert_eq!(normalize_channel_name("ESPN HD"), "espn");
    }

    #[test]
    fn test_normalize_removes_sd_suffix() {
        assert_eq!(normalize_channel_name("ESPN SD"), "espn");
    }

    #[test]
    fn test_normalize_removes_fhd_suffix() {
        assert_eq!(normalize_channel_name("ESPN FHD"), "espn");
    }

    #[test]
    fn test_normalize_removes_4k_suffix() {
        assert_eq!(normalize_channel_name("ESPN 4K"), "espn");
    }

    #[test]
    fn test_normalize_removes_uhd_suffix() {
        assert_eq!(normalize_channel_name("ESPN UHD"), "espn");
    }

    #[test]
    fn test_normalize_removes_1080p_suffix() {
        assert_eq!(normalize_channel_name("ESPN 1080p"), "espn");
    }

    #[test]
    fn test_normalize_removes_dash_suffix() {
        assert_eq!(normalize_channel_name("ESPN - 4K"), "espn");
    }

    #[test]
    fn test_normalize_preserves_numbers() {
        assert_eq!(normalize_channel_name("FOX Sports 1"), "fox sports 1");
    }

    #[test]
    fn test_normalize_removes_parentheses() {
        assert_eq!(normalize_channel_name("BBC One (UK)"), "bbc one uk");
    }

    #[test]
    fn test_normalize_collapses_spaces() {
        assert_eq!(normalize_channel_name("CNN  News"), "cnn news");
    }

    #[test]
    fn test_normalize_lowercase() {
        assert_eq!(normalize_channel_name("ESPN"), "espn");
    }

    #[test]
    fn test_normalize_complex_name() {
        assert_eq!(
            normalize_channel_name("ESPN - HD (US)"),
            "espn us"
        );
    }

    #[test]
    fn test_normalize_trims_whitespace() {
        assert_eq!(normalize_channel_name("  ESPN  "), "espn");
    }

    #[test]
    fn test_epg_ids_match_exact() {
        assert!(epg_ids_match(Some("espn.us"), "espn.us"));
    }

    #[test]
    fn test_epg_ids_match_case_insensitive() {
        assert!(epg_ids_match(Some("ESPN.US"), "espn.us"));
    }

    #[test]
    fn test_epg_ids_match_with_whitespace() {
        assert!(epg_ids_match(Some(" espn.us "), "espn.us"));
    }

    #[test]
    fn test_epg_ids_no_match() {
        assert!(!epg_ids_match(Some("cnn.us"), "espn.us"));
    }

    #[test]
    fn test_epg_ids_none() {
        assert!(!epg_ids_match(None, "espn.us"));
    }

    // Integration tests for match_channels would require mocking database models
    // These are tested in the integration test suite
}
