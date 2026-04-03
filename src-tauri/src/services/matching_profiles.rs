//! Matching profiles service — CRUD operations for per-source-pair normalization rules.

use diesel::prelude::*;

use crate::db::models::{MatchingProfile, MatchingProfileUpdate, NewMatchingProfile, NormalizationRule};
use crate::db::schema::matching_profiles;

/// List all matching profiles, optionally filtered by XMLTV source.
pub fn list_profiles(
    conn: &mut SqliteConnection,
    xmltv_source_id: Option<i32>,
) -> Result<Vec<MatchingProfile>, String> {
    let mut query = matching_profiles::table.into_boxed();

    if let Some(source_id) = xmltv_source_id {
        query = query.filter(matching_profiles::xmltv_source_id.eq(source_id));
    }

    query
        .order(matching_profiles::priority_order.asc())
        .load::<MatchingProfile>(conn)
        .map_err(|e| format!("Failed to list matching profiles: {}", e))
}

/// Get a single matching profile by ID.
pub fn get_profile(conn: &mut SqliteConnection, id: i32) -> Result<MatchingProfile, String> {
    matching_profiles::table
        .filter(matching_profiles::id.eq(id))
        .first::<MatchingProfile>(conn)
        .map_err(|e| format!("Matching profile not found: {}", e))
}

/// Create a new matching profile.
pub fn create_profile(
    conn: &mut SqliteConnection,
    new_profile: NewMatchingProfile,
) -> Result<MatchingProfile, String> {
    // Validate the rules JSON
    let _rules: Vec<NormalizationRule> = serde_json::from_str(&new_profile.rules)
        .map_err(|e| format!("Invalid rules JSON: {}", e))?;

    diesel::insert_into(matching_profiles::table)
        .values(&new_profile)
        .execute(conn)
        .map_err(|e| format!("Failed to create matching profile: {}", e))?;

    // Return the created profile
    matching_profiles::table
        .order(matching_profiles::id.desc())
        .first::<MatchingProfile>(conn)
        .map_err(|e| format!("Failed to retrieve created profile: {}", e))
}

/// Update an existing matching profile.
pub fn update_profile(
    conn: &mut SqliteConnection,
    id: i32,
    mut updates: MatchingProfileUpdate,
) -> Result<MatchingProfile, String> {
    // Validate rules JSON if provided
    if let Some(ref rules) = updates.rules {
        let _rules: Vec<NormalizationRule> = serde_json::from_str(rules)
            .map_err(|e| format!("Invalid rules JSON: {}", e))?;
    }

    updates.updated_at = Some(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());

    diesel::update(matching_profiles::table.filter(matching_profiles::id.eq(id)))
        .set(&updates)
        .execute(conn)
        .map_err(|e| format!("Failed to update matching profile: {}", e))?;

    get_profile(conn, id)
}

/// Delete a matching profile.
pub fn delete_profile(conn: &mut SqliteConnection, id: i32) -> Result<(), String> {
    let deleted = diesel::delete(matching_profiles::table.filter(matching_profiles::id.eq(id)))
        .execute(conn)
        .map_err(|e| format!("Failed to delete matching profile: {}", e))?;

    if deleted == 0 {
        return Err("Matching profile not found".to_string());
    }

    Ok(())
}

/// Reorder profiles for a given XMLTV source. Takes a list of profile IDs in the desired order.
pub fn reorder_profiles(
    conn: &mut SqliteConnection,
    profile_ids: &[i32],
) -> Result<Vec<MatchingProfile>, String> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    for (order, &profile_id) in profile_ids.iter().enumerate() {
        diesel::update(matching_profiles::table.filter(matching_profiles::id.eq(profile_id)))
            .set((
                matching_profiles::priority_order.eq(order as i32),
                matching_profiles::updated_at.eq(&now),
            ))
            .execute(conn)
            .map_err(|e| format!("Failed to reorder profile {}: {}", profile_id, e))?;
    }

    // Return the first profile to get its xmltv_source_id, then return all for that source
    if let Some(&first_id) = profile_ids.first() {
        let profile = get_profile(conn, first_id)?;
        list_profiles(conn, Some(profile.xmltv_source_id))
    } else {
        Ok(vec![])
    }
}

/// Preview normalization: apply a set of rules to a channel name and return the result.
pub fn preview_normalization(name: &str, rules: &[NormalizationRule]) -> String {
    apply_normalization_rules(name, rules)
}

/// Apply normalization rules to a channel name.
/// This is the core function used by both preview and the matcher integration.
pub fn apply_normalization_rules(name: &str, rules: &[NormalizationRule]) -> String {
    let mut result = name.to_string();

    for rule in rules {
        match rule {
            NormalizationRule::StripPrefix { value } => {
                if let Some(stripped) = result.strip_prefix(value.as_str()) {
                    result = stripped.to_string();
                }
                // Also try case-insensitive
                let lower = result.to_lowercase();
                let prefix_lower = value.to_lowercase();
                if lower.starts_with(&prefix_lower) {
                    result = result[value.len()..].to_string();
                }
            }
            NormalizationRule::StripSuffix { value } => {
                if let Some(stripped) = result.strip_suffix(value.as_str()) {
                    result = stripped.to_string();
                }
                // Also try case-insensitive
                let lower = result.to_lowercase();
                let suffix_lower = value.to_lowercase();
                if lower.ends_with(&suffix_lower) {
                    result = result[..result.len() - value.len()].to_string();
                }
            }
            NormalizationRule::RegexReplace {
                pattern,
                replacement,
            } => {
                if let Ok(re) = regex::Regex::new(pattern) {
                    result = re.replace_all(&result, replacement.as_str()).to_string();
                }
            }
        }
    }

    result.trim().to_string()
}

/// Load active profiles for a specific XMLTV source, keyed by (stream_source_type, stream_source_id).
pub fn get_active_profiles_for_xmltv_source(
    conn: &mut SqliteConnection,
    xmltv_source_id: i32,
) -> Result<Vec<MatchingProfile>, String> {
    matching_profiles::table
        .filter(matching_profiles::xmltv_source_id.eq(xmltv_source_id))
        .filter(matching_profiles::is_active.eq(1))
        .order(matching_profiles::priority_order.asc())
        .load::<MatchingProfile>(conn)
        .map_err(|e| format!("Failed to load active profiles: {}", e))
}
