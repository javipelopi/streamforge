//! Fuzzy Matching Algorithm
//!
//! Provides the core fuzzy matching functionality for matching XMLTV channels
//! to Xtream streams. This module handles name normalization and the matching
//! algorithm itself.

use regex::Regex;
use std::sync::LazyLock;

use super::{scorer::calculate_match_score, MatchConfig, MatchResult, MatchStats, MatchType};
use crate::db::models::{M3uChannel, NormalizationRule, XmltvChannel, XtreamChannel};
use crate::services::matching_profiles::{matches_prefix_filter, strip_provider_name};

/// Result of matching M3U channels to XMLTV channels
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct M3uMatchResult {
    /// XMLTV channel database ID
    pub xmltv_channel_id: i32,
    /// M3U channel database ID
    pub m3u_channel_id: i32,
    /// Confidence score (0.0 - 1.0)
    pub confidence: f64,
    /// Whether this is the primary stream for the channel
    pub is_primary: bool,
    /// Priority order for this stream (lower = higher priority)
    pub stream_priority: i32,
    /// Type of match that was found
    pub match_type: MatchType,
}

impl M3uMatchResult {
    pub fn new(
        xmltv_channel_id: i32,
        m3u_channel_id: i32,
        confidence: f64,
        match_type: MatchType,
    ) -> Self {
        Self {
            xmltv_channel_id,
            m3u_channel_id,
            confidence,
            is_primary: false,
            stream_priority: 0,
            match_type,
        }
    }
}

/// Regex pattern for removing non-alphanumeric characters except spaces
static NON_ALNUM_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^a-z0-9\s]").unwrap());

/// Regex pattern for collapsing multiple spaces into single space
static MULTI_SPACE_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+").unwrap());

/// Regex pattern for removing quality suffixes (HD, SD, FHD, 4K, UHD, etc.)
/// Only used by the legacy normalize_channel_name (no-profile fallback).
static QUALITY_SUFFIX_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\s*[-]?\s*(hd|sd|fhd|4k|uhd|1080p|720p|480p)(?:\s|$|\(|\))").unwrap()
});

/// Basic normalization: lowercase, collapse spaces, trim.
/// Does NOT strip quality suffixes -- those may be meaningful for prefix/suffix matching.
pub fn basic_normalize(name: &str) -> String {
    let lowered = name.to_lowercase();
    let collapsed = MULTI_SPACE_REGEX.replace_all(&lowered, " ");
    collapsed.trim().to_string()
}

/// Legacy normalize: lowercase, strip quality suffixes, remove punctuation, collapse spaces.
///
/// Used as fallback when no matching profile is configured.
///
/// # Examples
///
/// ```
/// use streamforge_lib::matcher::normalize_channel_name;
///
/// assert_eq!(normalize_channel_name("ESPN HD"), "espn");
/// assert_eq!(normalize_channel_name("ESPN FHD"), "espn");
/// assert_eq!(normalize_channel_name("ESPN - 4K"), "espn");
/// assert_eq!(normalize_channel_name("BBC One (UK)"), "bbc one uk");
/// assert_eq!(normalize_channel_name("CNN  News"), "cnn news");
/// ```
pub fn normalize_channel_name(name: &str) -> String {
    let lowered = name.to_lowercase();
    let without_suffix = QUALITY_SUFFIX_REGEX.replace_all(&lowered, "");
    let without_punct = NON_ALNUM_REGEX.replace_all(&without_suffix, " ");
    let collapsed = MULTI_SPACE_REGEX.replace_all(&without_punct, " ");
    collapsed.trim().to_string()
}

/// Legacy shim kept for backward compatibility.
pub fn normalize_with_rules(name: &str, rules: &[NormalizationRule]) -> String {
    if rules.is_empty() {
        normalize_channel_name(name)
    } else {
        basic_normalize(name)
    }
}

/// Match XMLTV channels to Xtream streams using fuzzy matching (no rules).
pub fn match_channels(
    xmltv_channels: &[XmltvChannel],
    xtream_channels: &[XtreamChannel],
    config: &MatchConfig,
) -> (Vec<MatchResult>, MatchStats) {
    match_channels_with_rules(xmltv_channels, xtream_channels, config, &[])
}

/// Match XMLTV channels to Xtream streams with per-profile prefix/suffix regex rules.
///
/// When rules are present:
///   1. Filter provider streams by prefix regex (only matching streams are candidates)
///   2. Strip prefix and suffix regex from provider stream names
///   3. Compare stripped provider name against XMLTV name (case-insensitive)
///
/// XMLTV names are never modified — they are the reference.
/// Display names in the target lineup remain the ORIGINAL XMLTV name.
pub fn match_channels_with_rules(
    xmltv_channels: &[XmltvChannel],
    xtream_channels: &[XtreamChannel],
    config: &MatchConfig,
    rules: &[NormalizationRule],
) -> (Vec<MatchResult>, MatchStats) {
    let start = std::time::Instant::now();
    let mut all_matches: Vec<MatchResult> = Vec::new();
    let mut stats = MatchStats {
        total_xmltv: xmltv_channels.len(),
        total_source_channels: xtream_channels.len(),
        ..Default::default()
    };

    let has_rules = !rules.is_empty();

    // When rules are present: filter by prefix, then strip prefix+suffix from provider names.
    // When no rules: use legacy normalization (strip quality suffixes).
    let xtream_normalized: Vec<(i32, String, Option<&str>)> = xtream_channels
        .iter()
        .filter_map(|c| {
            c.id.map(|id| (id, c.name.clone(), c.epg_channel_id.as_deref()))
        })
        .filter(|(_id, name, _epg)| {
            if has_rules {
                matches_prefix_filter(name, rules)
            } else {
                true
            }
        })
        .map(|(id, name, epg)| {
            let norm = if has_rules {
                let stripped = strip_provider_name(&name, rules);
                basic_normalize(&stripped)
            } else {
                normalize_channel_name(&name)
            };
            (id, norm, epg)
        })
        .collect();

    for xmltv in xmltv_channels {
        let xmltv_id = match xmltv.id {
            Some(id) => id,
            None => continue,
        };

        // XMLTV names are the reference — normalize but never augment/strip
        let xmltv_normalized = if has_rules {
            basic_normalize(&xmltv.display_name)
        } else {
            normalize_channel_name(&xmltv.display_name)
        };
        let xmltv_channel_id = &xmltv.channel_id;

        let mut channel_matches: Vec<MatchResult> = Vec::new();

        for (xtream_id, xtream_normalized, xtream_epg_id) in &xtream_normalized {
            let epg_id_match = epg_ids_match(*xtream_epg_id, xmltv_channel_id);
            let exact_name_match = xmltv_normalized == *xtream_normalized;

            let score = calculate_match_score(
                &xmltv_normalized,
                xtream_normalized,
                epg_id_match,
                exact_name_match,
                config,
            );

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

        channel_matches.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        let match_count = channel_matches.len();
        for (i, m) in channel_matches.iter_mut().enumerate() {
            m.is_primary = i == 0;
            m.stream_priority = i as i32;
        }
        if match_count > 0 {
            stats.matched += 1;
            if match_count > 1 { stats.multiple_matches += 1; }
        } else {
            stats.unmatched += 1;
        }
        all_matches.extend(channel_matches);
    }

    stats.duration_ms = start.elapsed().as_millis() as u64;
    (all_matches, stats)
}

/// Check if an EPG ID from an Xtream channel matches an XMLTV channel ID.
pub fn epg_ids_match(xtream_epg_id: Option<&str>, xmltv_channel_id: &str) -> bool {
    xtream_epg_id
        .map(|epg_id| epg_id.trim().eq_ignore_ascii_case(xmltv_channel_id.trim()))
        .unwrap_or(false)
}

/// Match M3U channels to XMLTV channels using fuzzy matching (no rules).
pub fn match_m3u_channels(
    xmltv_channels: &[XmltvChannel],
    m3u_channels: &[M3uChannel],
    config: &MatchConfig,
) -> (Vec<M3uMatchResult>, MatchStats) {
    match_m3u_channels_with_rules(xmltv_channels, m3u_channels, config, &[])
}

/// Match M3U channels to XMLTV channels with per-profile prefix/suffix regex rules.
///
/// Same logic as `match_channels_with_rules` but for M3U sources:
/// filter by prefix, strip prefix+suffix from provider names, compare against XMLTV.
pub fn match_m3u_channels_with_rules(
    xmltv_channels: &[XmltvChannel],
    m3u_channels: &[M3uChannel],
    config: &MatchConfig,
    rules: &[NormalizationRule],
) -> (Vec<M3uMatchResult>, MatchStats) {
    let start = std::time::Instant::now();
    let mut all_matches: Vec<M3uMatchResult> = Vec::new();
    let mut stats = MatchStats {
        total_xmltv: xmltv_channels.len(),
        total_source_channels: m3u_channels.len(),
        ..Default::default()
    };

    let has_rules = !rules.is_empty();

    let m3u_normalized: Vec<(i32, String, Option<&str>)> = m3u_channels
        .iter()
        .filter_map(|c| {
            c.id.map(|id| {
                let name_to_match = c.tvg_name.as_deref().unwrap_or(&c.name);
                (id, name_to_match.to_string(), c.tvg_id.as_deref())
            })
        })
        .filter(|(_id, name, _tvg)| {
            if has_rules {
                matches_prefix_filter(name, rules)
            } else {
                true
            }
        })
        .map(|(id, name, tvg)| {
            let norm = if has_rules {
                let stripped = strip_provider_name(&name, rules);
                basic_normalize(&stripped)
            } else {
                normalize_channel_name(&name)
            };
            (id, norm, tvg)
        })
        .collect();

    for xmltv in xmltv_channels {
        let xmltv_id = match xmltv.id {
            Some(id) => id,
            None => continue,
        };

        let xmltv_normalized = if has_rules {
            basic_normalize(&xmltv.display_name)
        } else {
            normalize_channel_name(&xmltv.display_name)
        };
        let xmltv_channel_id = &xmltv.channel_id;

        let mut channel_matches: Vec<M3uMatchResult> = Vec::new();

        for (m3u_id, m3u_normalized, m3u_tvg_id) in &m3u_normalized {
            let tvg_id_match = epg_ids_match(*m3u_tvg_id, xmltv_channel_id);
            let exact_name_match = xmltv_normalized == *m3u_normalized;

            let score = calculate_match_score(
                &xmltv_normalized,
                m3u_normalized,
                tvg_id_match,
                exact_name_match,
                config,
            );

            if score >= config.threshold {
                let match_type = if tvg_id_match {
                    MatchType::ExactEpgId
                } else if exact_name_match {
                    MatchType::ExactName
                } else {
                    MatchType::Fuzzy
                };
                channel_matches.push(M3uMatchResult::new(xmltv_id, *m3u_id, score, match_type));
            }
        }

        channel_matches.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        let match_count = channel_matches.len();
        for (i, m) in channel_matches.iter_mut().enumerate() {
            m.is_primary = i == 0;
            m.stream_priority = i as i32;
        }
        if match_count > 0 {
            stats.matched += 1;
            if match_count > 1 { stats.multiple_matches += 1; }
        } else {
            stats.unmatched += 1;
        }
        all_matches.extend(channel_matches);
    }

    stats.duration_ms = start.elapsed().as_millis() as u64;
    (all_matches, stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_removes_hd() {
        assert_eq!(normalize_channel_name("ESPN HD"), "espn");
    }

    #[test]
    fn test_normalize_preserves_numbers() {
        assert_eq!(normalize_channel_name("FOX Sports 1"), "fox sports 1");
    }

    #[test]
    fn test_basic_normalize_preserves_quality() {
        assert_eq!(basic_normalize("Spain La 1 FHD"), "spain la 1 fhd");
    }

    #[test]
    fn test_basic_normalize_preserves_hd() {
        assert_eq!(basic_normalize("ESPN HD"), "espn hd");
    }

    #[test]
    fn test_epg_ids_match_exact() {
        assert!(epg_ids_match(Some("espn.us"), "espn.us"));
    }

    #[test]
    fn test_epg_ids_no_match() {
        assert!(!epg_ids_match(Some("cnn.us"), "espn.us"));
    }

    #[test]
    fn test_strip_provider_name_matches_xmltv() {
        let rules = vec![NormalizationRule {
            prefix: r"ES\| ".to_string(),
            suffix: r" FHD$| HD$| SD$| HEVC$| 4K$".to_string(),
        }];
        let stripped = basic_normalize(&strip_provider_name("ES| ANTENA 3 FHD", &rules));
        let xmltv = basic_normalize("Antena 3");
        assert_eq!(stripped, xmltv);
    }

    #[test]
    fn test_prefix_filter() {
        let rules = vec![NormalizationRule {
            prefix: r"ES\| ".to_string(),
            suffix: String::new(),
        }];
        assert!(matches_prefix_filter("ES| ANTENA 3 FHD", &rules));
        assert!(!matches_prefix_filter("UK| BBC ONE HD", &rules));
    }

    #[test]
    fn test_strip_suffix_only() {
        let rules = vec![NormalizationRule {
            prefix: String::new(),
            suffix: r" FHD$| HD$| SD$".to_string(),
        }];
        let stripped = strip_provider_name("ESPN HD", &rules);
        assert_eq!(stripped, "ESPN");
    }
}
