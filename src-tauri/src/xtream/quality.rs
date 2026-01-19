//! Quality tier detection for Xtream channel names
//!
//! Implements FR4 (automatic quality grouping) by detecting quality indicators
//! from channel names using pattern matching.

use regex::Regex;
use std::sync::OnceLock;

/// Detect quality tiers from a channel name
///
/// Analyzes the channel name for quality indicators and returns a list
/// of detected quality tiers. If no quality is detected, defaults to "SD".
///
/// # Quality Detection Patterns
/// - **4K/UHD**: "4K", "UHD", "2160p", "2160P"
/// - **FHD**: "FHD", "1080p", "1080P", "1080i"
/// - **HD**: "HD" (but not part of "FHD" or "UHD")
/// - **SD**: "SD", or default when no quality indicator found
///
/// # Examples
/// ```
/// use iptv_lib::xtream::quality::detect_qualities;
///
/// assert_eq!(detect_qualities("ESPN HD"), vec!["HD"]);
/// assert_eq!(detect_qualities("CNN 4K"), vec!["4K"]);
/// assert_eq!(detect_qualities("BBC FHD 1080p"), vec!["FHD"]);
/// assert_eq!(detect_qualities("Local News"), vec!["SD"]); // Default
/// ```
pub fn detect_qualities(channel_name: &str) -> Vec<String> {
    static QUALITY_4K: OnceLock<Regex> = OnceLock::new();
    static QUALITY_FHD: OnceLock<Regex> = OnceLock::new();
    static QUALITY_HD_720P: OnceLock<Regex> = OnceLock::new();
    static QUALITY_SD: OnceLock<Regex> = OnceLock::new();

    let quality_4k = QUALITY_4K.get_or_init(|| {
        Regex::new(r"(?i)\b(4K|UHD|2160[pPi])\b").expect("Invalid 4K regex")
    });

    let quality_fhd = QUALITY_FHD.get_or_init(|| {
        Regex::new(r"(?i)\b(FHD|1080[pPi])\b").expect("Invalid FHD regex")
    });

    // Only match 720p/720i for HD - we'll handle standalone HD separately
    let quality_hd_720p = QUALITY_HD_720P.get_or_init(|| {
        Regex::new(r"(?i)\b720[pPi]\b").expect("Invalid HD 720p regex")
    });

    let quality_sd = QUALITY_SD.get_or_init(|| {
        // Match "SD" or low resolution indicators
        Regex::new(r"(?i)\bSD\b|(?i)\b(480[pPi]|576[pPi])\b").expect("Invalid SD regex")
    });

    let mut qualities = Vec::new();

    // Check for 4K (includes UHD)
    let has_4k = quality_4k.is_match(channel_name);
    if has_4k {
        qualities.push("4K".to_string());
    }

    // Check for FHD (includes 1080p/i)
    let has_fhd = quality_fhd.is_match(channel_name);
    if has_fhd {
        qualities.push("FHD".to_string());
    }

    // Check for HD - handle standalone " HD" that's not part of FHD/UHD
    let has_hd_720p = quality_hd_720p.is_match(channel_name);
    let has_standalone_hd = has_standalone_hd(channel_name);

    if has_hd_720p || has_standalone_hd {
        qualities.push("HD".to_string());
    }

    // Check for SD
    if quality_sd.is_match(channel_name) {
        qualities.push("SD".to_string());
    }

    // Default to SD if no quality detected
    if qualities.is_empty() {
        qualities.push("SD".to_string());
    }

    qualities
}

/// Check for standalone "HD" that's not part of "FHD" or "UHD"
fn has_standalone_hd(name: &str) -> bool {
    let upper = name.to_uppercase();

    // Find all occurrences of "HD" and check if they're standalone
    let mut idx = 0;
    while let Some(pos) = upper[idx..].find("HD") {
        let absolute_pos = idx + pos;

        // Check if preceded by F (FHD) or U (UHD)
        let preceded_by_f_or_u = absolute_pos > 0 && {
            let prev_char = upper.chars().nth(absolute_pos - 1);
            matches!(prev_char, Some('F') | Some('U'))
        };

        // Check if it's at a word boundary (start or preceded by non-alphanumeric)
        let at_word_start = absolute_pos == 0 || {
            let prev_char = upper.chars().nth(absolute_pos - 1);
            prev_char.map(|c| !c.is_alphanumeric()).unwrap_or(true)
        };

        // Check if it ends at a word boundary
        let after_hd = absolute_pos + 2;
        let at_word_end = after_hd >= upper.len() || {
            let next_char = upper.chars().nth(after_hd);
            next_char.map(|c| !c.is_alphanumeric()).unwrap_or(true)
        };

        // It's a standalone HD if:
        // 1. It's at a word boundary (both start and end)
        // 2. Not preceded by F or U
        if at_word_start && at_word_end && !preceded_by_f_or_u {
            return true;
        }

        // Move past this occurrence
        idx = absolute_pos + 2;
        if idx >= upper.len() {
            break;
        }
    }

    false
}

/// Convert qualities vector to JSON string for database storage
pub fn qualities_to_json(qualities: &[String]) -> String {
    serde_json::to_string(qualities).unwrap_or_else(|_| r#"["SD"]"#.to_string())
}

/// Parse JSON qualities string from database to vector
pub fn qualities_from_json(json: &str) -> Vec<String> {
    serde_json::from_str(json).unwrap_or_else(|_| vec!["SD".to_string()])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_4k_quality() {
        assert!(detect_qualities("ESPN 4K").contains(&"4K".to_string()));
        assert!(detect_qualities("CNN UHD").contains(&"4K".to_string()));
        assert!(detect_qualities("HBO 2160p").contains(&"4K".to_string()));
        assert!(detect_qualities("Movie 2160P").contains(&"4K".to_string()));
    }

    #[test]
    fn test_detect_fhd_quality() {
        assert!(detect_qualities("BBC FHD").contains(&"FHD".to_string()));
        assert!(detect_qualities("Sports 1080p").contains(&"FHD".to_string()));
        assert!(detect_qualities("News 1080P").contains(&"FHD".to_string()));
        assert!(detect_qualities("Movie 1080i").contains(&"FHD".to_string()));
    }

    #[test]
    fn test_detect_hd_quality() {
        assert!(detect_qualities("ESPN HD").contains(&"HD".to_string()));
        assert!(detect_qualities("CNN HD News").contains(&"HD".to_string()));
        assert!(detect_qualities("Sports 720p").contains(&"HD".to_string()));
    }

    #[test]
    fn test_detect_sd_quality() {
        assert!(detect_qualities("Local SD").contains(&"SD".to_string()));
        assert!(detect_qualities("News 480p").contains(&"SD".to_string()));
        assert!(detect_qualities("Classic 576i").contains(&"SD".to_string()));
    }

    #[test]
    fn test_default_to_sd_when_no_quality() {
        let qualities = detect_qualities("Generic Channel");
        assert_eq!(qualities, vec!["SD"]);

        let qualities = detect_qualities("Local News");
        assert_eq!(qualities, vec!["SD"]);
    }

    #[test]
    fn test_hd_not_detected_in_fhd() {
        let qualities = detect_qualities("ESPN FHD");
        assert!(qualities.contains(&"FHD".to_string()));
        assert!(!qualities.contains(&"HD".to_string()));
    }

    #[test]
    fn test_hd_not_detected_in_uhd() {
        let qualities = detect_qualities("CNN UHD");
        assert!(qualities.contains(&"4K".to_string()));
        assert!(!qualities.contains(&"HD".to_string()));
    }

    #[test]
    fn test_case_insensitive_detection() {
        assert!(detect_qualities("ESPN hd").contains(&"HD".to_string()));
        assert!(detect_qualities("CNN 4k").contains(&"4K".to_string()));
        assert!(detect_qualities("BBC Fhd").contains(&"FHD".to_string()));
        assert!(detect_qualities("Local sd").contains(&"SD".to_string()));
    }

    #[test]
    fn test_multiple_qualities_detected() {
        // Some channels may have multiple quality indicators in their name
        let qualities = detect_qualities("ESPN HD SD Simulcast");
        assert!(qualities.contains(&"HD".to_string()));
        assert!(qualities.contains(&"SD".to_string()));
    }

    #[test]
    fn test_qualities_to_json() {
        let qualities = vec!["HD".to_string()];
        assert_eq!(qualities_to_json(&qualities), r#"["HD"]"#);

        let qualities = vec!["4K".to_string(), "HD".to_string()];
        let json = qualities_to_json(&qualities);
        assert!(json.contains("4K"));
        assert!(json.contains("HD"));
    }

    #[test]
    fn test_qualities_from_json() {
        let qualities = qualities_from_json(r#"["HD"]"#);
        assert_eq!(qualities, vec!["HD"]);

        let qualities = qualities_from_json(r#"["4K","FHD"]"#);
        assert_eq!(qualities, vec!["4K", "FHD"]);
    }

    #[test]
    fn test_qualities_from_invalid_json() {
        let qualities = qualities_from_json("invalid");
        assert_eq!(qualities, vec!["SD"]); // Default fallback
    }
}
