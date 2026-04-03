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

/// Preview: strip a provider name using prefix/suffix regex from the first rule.
pub fn preview_normalization(name: &str, rules: &[NormalizationRule]) -> String {
    strip_provider_name(name, rules)
}

/// Strip prefix and suffix regex patterns from a provider stream name.
///
/// The first rule's `prefix` and `suffix` fields are treated as regex patterns.
/// The prefix regex is removed from the start of the name, the suffix regex
/// from the end. Returns the stripped result (trimmed).
pub fn strip_provider_name(name: &str, rules: &[NormalizationRule]) -> String {
    if let Some(rule) = rules.first() {
        let mut result = name.to_string();

        if !rule.prefix.is_empty() {
            if let Ok(re) = regex::Regex::new(&format!("^(?:{})", rule.prefix)) {
                result = re.replace(&result, "").to_string();
            }
        }

        if !rule.suffix.is_empty() {
            if let Ok(re) = regex::Regex::new(&format!("(?:{})$", rule.suffix)) {
                result = re.replace(&result, "").to_string();
            }
        }

        result.trim().to_string()
    } else {
        name.to_string()
    }
}

/// Check whether a provider name matches the prefix filter from the first rule.
/// If no prefix is set, all names pass the filter.
pub fn matches_prefix_filter(name: &str, rules: &[NormalizationRule]) -> bool {
    if let Some(rule) = rules.first() {
        if rule.prefix.is_empty() {
            return true;
        }
        if let Ok(re) = regex::Regex::new(&format!("^(?:{})", rule.prefix)) {
            re.is_match(name)
        } else {
            true // Invalid regex → don't filter
        }
    } else {
        true
    }
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
