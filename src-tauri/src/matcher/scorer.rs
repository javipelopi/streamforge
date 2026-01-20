//! Match Confidence Scoring
//!
//! Provides scoring algorithms for channel matching using Jaro-Winkler
//! similarity with boosts for EPG ID and exact name matches.

use strsim::jaro_winkler;

use super::MatchConfig;

/// Calculate the match score between an XMLTV channel name and an Xtream stream name.
///
/// The score is based on Jaro-Winkler similarity with optional boosts:
/// - EPG ID match boost (+0.15 default) when the Xtream stream's EPG ID matches the XMLTV channel ID
/// - Exact name boost (+0.10 default) when normalized names are identical
///
/// The final score is clamped to a maximum of 1.0.
///
/// # Arguments
///
/// * `xmltv_name` - The normalized XMLTV channel name
/// * `xtream_name` - The normalized Xtream stream name
/// * `epg_id_match` - Whether the EPG IDs match exactly
/// * `exact_name_match` - Whether the normalized names are identical
/// * `config` - The match configuration containing boost values
///
/// # Returns
///
/// A score between 0.0 and 1.0 representing match confidence
pub fn calculate_match_score(
    xmltv_name: &str,
    xtream_name: &str,
    epg_id_match: bool,
    exact_name_match: bool,
    config: &MatchConfig,
) -> f64 {
    // Base score from Jaro-Winkler similarity
    let base_score = jaro_winkler(xmltv_name, xtream_name);

    // Apply boosts
    let epg_boost = if epg_id_match { config.epg_id_boost } else { 0.0 };
    let exact_boost = if exact_name_match {
        config.exact_name_boost
    } else {
        0.0
    };

    // Clamp to maximum of 1.0
    (base_score + epg_boost + exact_boost).min(1.0)
}

/// Calculate the raw Jaro-Winkler similarity score between two strings.
///
/// This is useful for testing or when you want the base score without any boosts.
pub fn jaro_winkler_score(s1: &str, s2: &str) -> f64 {
    jaro_winkler(s1, s2)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_config() -> MatchConfig {
        MatchConfig::default()
    }

    #[test]
    fn test_exact_match_score() {
        let config = default_config();
        let score = calculate_match_score("espn", "espn", false, true, &config);
        // Jaro-Winkler of identical strings is 1.0, plus exact name boost of 0.10, clamped to 1.0
        assert!((score - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_fuzzy_match_score() {
        let config = default_config();
        // "espn" vs "espn hd" should have high similarity but not perfect
        let score = calculate_match_score("espn", "espn hd", false, false, &config);
        assert!(score > 0.8);
        assert!(score < 1.0);
    }

    #[test]
    fn test_epg_id_boost() {
        let config = default_config();
        // Use strings with lower base similarity to avoid clamping
        let base_score = calculate_match_score("abc", "abd", false, false, &config);
        let boosted_score = calculate_match_score("abc", "abd", true, false, &config);

        // Score with EPG boost should be higher
        assert!(boosted_score > base_score);
        // The difference should be approximately the EPG boost value (accounting for potential clamping)
        let expected_diff = config.epg_id_boost;
        let actual_diff = boosted_score - base_score;
        assert!(
            actual_diff >= expected_diff - 0.01 || boosted_score >= 1.0 - f64::EPSILON,
            "EPG boost not applied correctly: expected diff ~{}, got {}",
            expected_diff,
            actual_diff
        );
    }

    #[test]
    fn test_exact_name_boost() {
        let config = default_config();
        let base_score = calculate_match_score("espn", "espn", false, false, &config);
        let boosted_score = calculate_match_score("espn", "espn", false, true, &config);

        // Score with exact name boost should be higher (but clamped to 1.0)
        assert!(boosted_score >= base_score);
        assert!((boosted_score - 1.0).abs() < f64::EPSILON); // Should be clamped to 1.0
    }

    #[test]
    fn test_combined_boosts_clamped() {
        let config = default_config();
        // With both boosts on an exact match, should clamp to 1.0
        let score = calculate_match_score("espn", "espn", true, true, &config);
        assert!((score - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_low_similarity_no_boost() {
        let config = default_config();
        let score = calculate_match_score("cnn", "fox news", false, false, &config);
        // Completely different names should have low score
        assert!(score < 0.5);
    }

    #[test]
    fn test_jaro_winkler_raw() {
        // Test the raw Jaro-Winkler function
        let score = jaro_winkler_score("espn", "espn");
        assert!((score - 1.0).abs() < f64::EPSILON);

        let score2 = jaro_winkler_score("cnn", "fox");
        assert!(score2 < 0.5);
    }

    #[test]
    fn test_similar_channels() {
        let config = default_config();

        // Test cases - verifying relative scoring behavior
        // High similarity channels should score high
        let espn_score = calculate_match_score("espn", "espn hd", false, false, &config);
        assert!(espn_score > 0.85, "ESPN vs ESPN HD should score > 0.85, got {}", espn_score);

        let bbc_score = calculate_match_score("bbc one", "bbc one uk", false, false, &config);
        assert!(bbc_score > 0.85, "BBC One vs BBC One UK should score > 0.85, got {}", bbc_score);

        // Low similarity channels should score low
        let low_score = calculate_match_score("cnn", "fox news", false, false, &config);
        assert!(low_score < 0.60, "CNN vs Fox News should score < 0.60, got {}", low_score);
    }
}
