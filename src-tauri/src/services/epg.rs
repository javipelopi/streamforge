//! EPG service — XMLTV source CRUD, EPG refresh, stats, search, and schedule.
//!
//! Extracted from `commands/epg.rs`. Network I/O (XMLTV fetch) is async.
//! The EpgScheduler interaction stays in the command layer since it's Tauri-managed state.

use std::collections::HashMap;

use diesel::prelude::*;

use crate::commands::epg::{
    ChannelInfo, ChannelStreamInfo, EpgGridChannel, EpgGridProgram, EpgSearchResult,
    EpgSourceError, EpgStatsResponse, ProgramResponse, ProgramWithChannel, SearchMatchType,
    SearchResultType, XmltvChannelResponse, XmltvSourceResponse,
};
use crate::db::schema::{channel_mappings, programs, xmltv_channel_settings, xmltv_channels, xmltv_sources, xtream_channels};
use crate::db::{
    NewProgram, NewXmltvChannel, NewXmltvSource, Program, XmltvChannel, XmltvChannelSettings,
    XmltvSource, XmltvSourceUpdate,
};
use crate::epg_ops::{preserve_channel_data, restore_channel_data};
use crate::logging::log_event_internal;
use crate::xmltv::{fetch_xmltv, parse_xmltv_data};

/// Batch size for inserting programs.
const BATCH_SIZE: usize = 500;

// ---------------------------------------------------------------------------
// URL / format validation (re-exported for tests in commands)
// ---------------------------------------------------------------------------

/// Validate URL format and check for SSRF risks.
pub fn validate_url(url_str: &str) -> Result<(), EpgSourceError> {
    if url_str.trim().is_empty() {
        return Err(EpgSourceError::UrlRequired);
    }

    let parsed = url::Url::parse(url_str.trim()).map_err(|_| EpgSourceError::InvalidUrl)?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(EpgSourceError::InvalidUrlScheme);
    }

    if let Some(host) = parsed.host_str() {
        let host_lower = host.to_lowercase();
        if host_lower == "localhost"
            || host_lower == "127.0.0.1"
            || host_lower.starts_with("127.")
            || host_lower == "::1"
            || host_lower == "0.0.0.0"
        {
            return Err(EpgSourceError::InvalidUrl);
        }
        if host_lower.starts_with("10.")
            || host_lower.starts_with("192.168.")
            || is_172_private(&host_lower)
            || host_lower.starts_with("169.254.")
        {
            return Err(EpgSourceError::InvalidUrl);
        }
    }

    Ok(())
}

fn is_172_private(host: &str) -> bool {
    if !host.starts_with("172.") {
        return false;
    }
    let parts: Vec<&str> = host.split('.').collect();
    if parts.len() < 2 {
        return false;
    }
    if let Ok(second_octet) = parts[1].parse::<u8>() {
        return (16..=31).contains(&second_octet);
    }
    false
}

/// Validate format value.
pub fn validate_format(format: &str) -> Result<(), EpgSourceError> {
    let valid_formats = ["xml", "xml_gz", "auto"];
    if !valid_formats.contains(&format) {
        return Err(EpgSourceError::InvalidFormat);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// XMLTV Source CRUD
// ---------------------------------------------------------------------------

/// Add a new XMLTV source.
pub fn add_xmltv_source(
    conn: &mut SqliteConnection,
    name: &str,
    url: &str,
    format: &str,
) -> Result<XmltvSourceResponse, EpgSourceError> {
    if name.trim().is_empty() {
        return Err(EpgSourceError::NameRequired);
    }
    validate_url(url)?;
    validate_format(format)?;

    let new_source = NewXmltvSource::new(name.trim(), url.trim(), format);

    let inserted: XmltvSource = diesel::insert_into(xmltv_sources::table)
        .values(&new_source)
        .get_result(conn)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                EpgSourceError::DuplicateUrl
            } else {
                EpgSourceError::DatabaseError(e.to_string())
            }
        })?;

    Ok(XmltvSourceResponse::from(inserted))
}

/// Get all XMLTV sources.
pub fn get_xmltv_sources(
    conn: &mut SqliteConnection,
) -> Result<Vec<XmltvSourceResponse>, EpgSourceError> {
    let sources: Vec<XmltvSource> = xmltv_sources::table
        .order(xmltv_sources::name.asc())
        .load(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(sources.into_iter().map(XmltvSourceResponse::from).collect())
}

/// Update an existing XMLTV source.
pub fn update_xmltv_source(
    conn: &mut SqliteConnection,
    source_id: i32,
    updates: XmltvSourceUpdate,
) -> Result<XmltvSourceResponse, EpgSourceError> {
    if let Some(ref new_url) = updates.url {
        validate_url(new_url)?;
    }
    if let Some(ref new_format) = updates.format {
        validate_format(new_format)?;
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let updates_with_timestamp = XmltvSourceUpdate {
        updated_at: Some(now),
        ..updates
    };

    let affected = diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
        .set(&updates_with_timestamp)
        .execute(conn)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                EpgSourceError::DuplicateUrl
            } else {
                EpgSourceError::DatabaseError(e.to_string())
            }
        })?;

    if affected == 0 {
        return Err(EpgSourceError::NotFound);
    }

    let updated: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(XmltvSourceResponse::from(updated))
}

/// Delete an XMLTV source.
pub fn delete_xmltv_source(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<(), EpgSourceError> {
    let deleted = diesel::delete(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
        .execute(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    if deleted == 0 {
        return Err(EpgSourceError::NotFound);
    }
    Ok(())
}

/// Toggle XMLTV source active state.
pub fn toggle_xmltv_source(
    conn: &mut SqliteConnection,
    source_id: i32,
    active: bool,
) -> Result<XmltvSourceResponse, EpgSourceError> {
    let is_active_int = if active { 1 } else { 0 };
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let affected = diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
        .set((
            xmltv_sources::is_active.eq(is_active_int),
            xmltv_sources::updated_at.eq(&now),
        ))
        .execute(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    if affected == 0 {
        return Err(EpgSourceError::NotFound);
    }

    let updated: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(XmltvSourceResponse::from(updated))
}

// ---------------------------------------------------------------------------
// EPG Refresh
// ---------------------------------------------------------------------------

/// Refresh EPG data for a single source (fetch + parse + store).
pub async fn refresh_epg_source(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<(), String> {
    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(conn)
        .map_err(|e| {
            if e == diesel::NotFound {
                EpgSourceError::NotFound.to_string()
            } else {
                EpgSourceError::DatabaseError(e.to_string()).to_string()
            }
        })?;

    let source_name = source.name.clone();

    let data = match fetch_xmltv(&source.url, &source.format).await {
        Ok(d) => d,
        Err(e) => {
            let epg_error = EpgSourceError::from(e);
            let details = serde_json::json!({
                "sourceId": source_id,
                "sourceName": source_name,
                "error": epg_error.to_string(),
            });
            let _ = log_event_internal(
                conn,
                "error",
                "epg",
                &format!("EPG refresh failed: {} - {}", source_name, epg_error),
                Some(&details.to_string()),
            );
            return Err(epg_error.to_string());
        }
    };

    let (parsed_channels, parsed_programs) = match parse_xmltv_data(&data) {
        Ok(result) => result,
        Err(e) => {
            let epg_error = EpgSourceError::from(e);
            let details = serde_json::json!({
                "sourceId": source_id,
                "sourceName": source_name,
                "error": epg_error.to_string(),
            });
            let _ = log_event_internal(
                conn,
                "error",
                "epg",
                &format!("EPG parse failed: {} - {}", source_name, epg_error),
                Some(&details.to_string()),
            );
            return Err(epg_error.to_string());
        }
    };

    let channel_count = parsed_channels.len();
    let program_count = parsed_programs.len();

    store_epg_data(conn, source_id, &source_name, &parsed_channels, &parsed_programs, channel_count, program_count)?;

    Ok(())
}

/// Refresh EPG data for all active sources.
pub async fn refresh_all_epg_sources(conn: &mut SqliteConnection) -> Result<(), String> {
    let sources: Vec<XmltvSource> = xmltv_sources::table
        .filter(xmltv_sources::is_active.eq(1))
        .load(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()).to_string())?;

    let mut failed_sources: Vec<String> = Vec::new();
    let mut success_count = 0;

    for source in sources {
        let source_id = source.id.unwrap_or(0);
        let source_name = source.name.clone();

        let data = match fetch_xmltv(&source.url, &source.format).await {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Failed to fetch source {}: {}", source.name, e);
                failed_sources.push(format!("{}: {}", source.name, e));
                continue;
            }
        };

        let (parsed_channels, parsed_programs) = match parse_xmltv_data(&data) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("Failed to parse source {}: {}", source.name, e);
                failed_sources.push(format!("{}: {}", source.name, e));
                continue;
            }
        };

        let channel_count = parsed_channels.len();
        let program_count = parsed_programs.len();

        match store_epg_data(conn, source_id, &source_name, &parsed_channels, &parsed_programs, channel_count, program_count) {
            Ok(()) => { success_count += 1; }
            Err(e) => {
                eprintln!("Failed to refresh source {}: {}", source.name, e);
                failed_sources.push(format!("{}: {}", source.name, e));
            }
        }
    }

    if !failed_sources.is_empty() && success_count == 0 {
        return Err(format!(
            "All EPG sources failed to refresh: {}",
            failed_sources.join("; ")
        ));
    }
    if !failed_sources.is_empty() {
        return Err(format!(
            "Some EPG sources failed: {}. {} source(s) refreshed successfully.",
            failed_sources.join("; "),
            success_count
        ));
    }

    Ok(())
}

/// Store parsed EPG data into the database (transaction).
fn store_epg_data(
    conn: &mut SqliteConnection,
    source_id: i32,
    source_name: &str,
    parsed_channels: &[crate::xmltv::XmltvChannelData],
    parsed_programs: &[crate::xmltv::XmltvProgramData],
    channel_count: usize,
    program_count: usize,
) -> Result<(), String> {
    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        let preserved = preserve_channel_data(conn, source_id)?;

        diesel::delete(xmltv_channels::table.filter(xmltv_channels::source_id.eq(source_id)))
            .execute(conn)?;

        let mut channel_id_map: HashMap<String, i32> = HashMap::new();

        for parsed_channel in parsed_channels {
            let new_channel = NewXmltvChannel::new(
                source_id,
                &parsed_channel.channel_id,
                &parsed_channel.display_name,
                parsed_channel.icon.clone(),
            );

            let inserted: XmltvChannel = diesel::insert_into(xmltv_channels::table)
                .values(&new_channel)
                .get_result(conn)?;

            if let Some(id) = inserted.id {
                channel_id_map.insert(parsed_channel.channel_id.clone(), id);
            }
        }

        let mut programs_to_insert: Vec<NewProgram> = Vec::with_capacity(BATCH_SIZE);

        for parsed_program in parsed_programs {
            if let Some(&channel_db_id) = channel_id_map.get(&parsed_program.channel_id) {
                let mut new_program = NewProgram::new(
                    channel_db_id,
                    &parsed_program.title,
                    &parsed_program.start_time,
                    &parsed_program.end_time,
                );

                if let Some(ref desc) = parsed_program.description {
                    new_program = new_program.with_description(desc);
                }
                if let Some(ref cat) = parsed_program.category {
                    new_program = new_program.with_category(cat);
                }
                if let Some(ref ep) = parsed_program.episode_info {
                    new_program = new_program.with_episode_info(ep);
                }

                programs_to_insert.push(new_program);

                if programs_to_insert.len() >= BATCH_SIZE {
                    diesel::insert_into(programs::table)
                        .values(&programs_to_insert)
                        .execute(conn)?;
                    programs_to_insert.clear();
                }
            }
        }

        if !programs_to_insert.is_empty() {
            diesel::insert_into(programs::table)
                .values(&programs_to_insert)
                .execute(conn)?;
        }

        restore_channel_data(conn, &preserved, &channel_id_map)?;

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
            .set(xmltv_sources::last_refresh.eq(&now))
            .execute(conn)?;

        let details = serde_json::json!({
            "sourceId": source_id,
            "sourceName": source_name,
            "channelCount": channel_count,
            "programCount": program_count,
        });
        let _ = log_event_internal(
            conn,
            "info",
            "epg",
            &format!(
                "EPG refresh completed: {} ({} channels, {} programs)",
                source_name, channel_count, program_count
            ),
            Some(&details.to_string()),
        );

        Ok(())
    })
    .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// EPG Stats & Queries
// ---------------------------------------------------------------------------

/// Get EPG statistics for a source.
pub fn get_epg_stats(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<EpgStatsResponse, EpgSourceError> {
    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(conn)
        .map_err(|e| {
            if e == diesel::NotFound {
                EpgSourceError::NotFound
            } else {
                EpgSourceError::DatabaseError(e.to_string())
            }
        })?;

    let channel_count: i64 = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .count()
        .get_result(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let program_count: i64 = programs::table
        .inner_join(xmltv_channels::table)
        .filter(xmltv_channels::source_id.eq(source_id))
        .count()
        .get_result(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(EpgStatsResponse {
        channel_count,
        program_count,
        last_refresh: source.last_refresh,
    })
}

/// Get all XMLTV channels for a source.
pub fn get_xmltv_channels(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<Vec<XmltvChannelResponse>, EpgSourceError> {
    let channels: Vec<XmltvChannel> = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .order(xmltv_channels::display_name.asc())
        .load(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(channels.into_iter().map(XmltvChannelResponse::from).collect())
}

/// Get programs for a source (through channels).
pub fn get_programs(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<Vec<ProgramResponse>, EpgSourceError> {
    let progs: Vec<Program> = programs::table
        .inner_join(xmltv_channels::table)
        .filter(xmltv_channels::source_id.eq(source_id))
        .select(programs::all_columns)
        .order(programs::start_time.asc())
        .load(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(progs.into_iter().map(ProgramResponse::from).collect())
}

/// Get EPG schedule settings.
pub fn get_epg_schedule(conn: &mut SqliteConnection) -> crate::commands::epg::EpgScheduleResponse {
    let config = crate::scheduler::get_epg_schedule(conn);
    let last_refresh = crate::scheduler::get_last_scheduled_refresh(conn);

    crate::commands::epg::EpgScheduleResponse {
        hour: config.hour,
        minute: config.minute,
        enabled: config.enabled,
        last_scheduled_refresh: last_refresh.map(|dt| dt.to_rfc3339()),
    }
}

/// Search EPG programs and channels.
pub fn search_epg_programs(
    conn: &mut SqliteConnection,
    query: &str,
) -> Result<Vec<EpgSearchResult>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    let escaped_query = query.replace('%', r"\%").replace('_', r"\_");
    let like_pattern = format!("%{}%", escaped_query);

    let enabled_channels: Vec<(XmltvChannel, XmltvChannelSettings)> = xmltv_channels::table
        .inner_join(xmltv_channel_settings::table)
        .filter(xmltv_channel_settings::is_enabled.eq(1))
        .select((xmltv_channels::all_columns, xmltv_channel_settings::all_columns))
        .load(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()).to_string())?;

    if enabled_channels.is_empty() {
        return Ok(Vec::new());
    }

    let enabled_channel_ids: Vec<i32> = enabled_channels.iter().filter_map(|(c, _)| c.id).collect();

    let results: Vec<(Program, XmltvChannel)> = programs::table
        .inner_join(xmltv_channels::table)
        .filter(programs::xmltv_channel_id.eq_any(&enabled_channel_ids))
        .filter(programs::end_time.gt(&now))
        .filter(
            programs::title
                .like(&like_pattern)
                .or(programs::description.like(&like_pattern))
                .or(xmltv_channels::display_name.like(&like_pattern)),
        )
        .select((programs::all_columns, xmltv_channels::all_columns))
        .order(programs::start_time.asc())
        .limit(50)
        .load(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()).to_string())?;

    let query_lower = query.to_lowercase();

    let program_results: Vec<EpgSearchResult> = results
        .into_iter()
        .map(|(program, channel)| {
            let title_lower = program.title.to_lowercase();
            let channel_lower = channel.display_name.to_lowercase();
            let desc_lower = program.description.as_ref().map(|d| d.to_lowercase()).unwrap_or_default();

            let (match_type, relevance_score) = if title_lower.contains(&query_lower) {
                (SearchMatchType::Title, 1.0)
            } else if channel_lower.contains(&query_lower) {
                (SearchMatchType::Channel, 0.8)
            } else if desc_lower.contains(&query_lower) {
                (SearchMatchType::Description, 0.6)
            } else {
                (SearchMatchType::Description, 0.5)
            };

            EpgSearchResult {
                result_type: SearchResultType::Program,
                program_id: Some(program.id.unwrap_or(0)),
                title: program.title,
                description: program.description,
                start_time: Some(program.start_time),
                end_time: Some(program.end_time),
                category: program.category,
                channel_id: channel.id.unwrap_or(0),
                channel_name: channel.display_name,
                channel_icon: channel.icon,
                match_type,
                relevance_score,
            }
        })
        .collect();

    let channel_results: Vec<EpgSearchResult> = enabled_channels
        .into_iter()
        .filter_map(|(channel, _)| {
            let channel_id = channel.id.unwrap_or(0);
            let channel_lower = channel.display_name.to_lowercase();
            if !channel_lower.contains(&query_lower) {
                return None;
            }
            let relevance_score = if channel_lower == query_lower { 1.0 } else { 0.9 };
            Some(EpgSearchResult {
                result_type: SearchResultType::Channel,
                program_id: None,
                title: channel.display_name.clone(),
                description: None,
                start_time: None,
                end_time: None,
                category: None,
                channel_id,
                channel_name: channel.display_name,
                channel_icon: channel.icon,
                match_type: SearchMatchType::Channel,
                relevance_score,
            })
        })
        .collect();

    let mut all_results: Vec<EpgSearchResult> = program_results;
    all_results.extend(channel_results);

    all_results.sort_by(|a, b| {
        let type_order = match (&a.result_type, &b.result_type) {
            (SearchResultType::Channel, SearchResultType::Program) => std::cmp::Ordering::Less,
            (SearchResultType::Program, SearchResultType::Channel) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        };
        type_order
            .then_with(|| {
                b.relevance_score
                    .partial_cmp(&a.relevance_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| match (&a.start_time, &b.start_time) {
                (None, None) => std::cmp::Ordering::Equal,
                (None, Some(_)) => std::cmp::Ordering::Less,
                (Some(_), None) => std::cmp::Ordering::Greater,
                (Some(a_time), Some(b_time)) => a_time.cmp(b_time),
            })
    });

    Ok(all_results)
}

/// Get all enabled XMLTV channels with programs in a time range.
pub fn get_enabled_channels_with_programs(
    conn: &mut SqliteConnection,
    start_time: &str,
    end_time: &str,
) -> Result<Vec<EpgGridChannel>, String> {
    let enabled_channels: Vec<(XmltvChannel, XmltvChannelSettings)> = xmltv_channels::table
        .inner_join(xmltv_channel_settings::table)
        .filter(xmltv_channel_settings::is_enabled.eq(1))
        .order((
            xmltv_channel_settings::plex_display_order.asc(),
            xmltv_channels::display_name.asc(),
        ))
        .select((xmltv_channels::all_columns, xmltv_channel_settings::all_columns))
        .load(conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()).to_string())?;

    let mut result: Vec<EpgGridChannel> = Vec::with_capacity(enabled_channels.len());

    for (channel, settings) in enabled_channels {
        let channel_id = channel.id.unwrap_or(0);

        let channel_programs: Vec<Program> = programs::table
            .filter(programs::xmltv_channel_id.eq(channel_id))
            .filter(programs::start_time.lt(end_time))
            .filter(programs::end_time.gt(start_time))
            .order(programs::start_time.asc())
            .load(conn)
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()).to_string())?;

        let progs: Vec<EpgGridProgram> = channel_programs
            .into_iter()
            .map(|p| EpgGridProgram {
                id: p.id.unwrap_or(0),
                title: p.title,
                start_time: p.start_time,
                end_time: p.end_time,
                category: p.category,
                description: p.description,
                episode_info: p.episode_info,
            })
            .collect();

        result.push(EpgGridChannel {
            channel_id,
            channel_name: channel.display_name,
            channel_icon: channel.icon,
            plex_display_order: settings.plex_display_order.unwrap_or(9999),
            programs: progs,
        });
    }

    Ok(result)
}

/// Get stream info for an XMLTV channel.
pub fn get_channel_stream_info(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<Option<ChannelStreamInfo>, EpgSourceError> {
    let result: Option<(crate::db::ChannelMapping, crate::db::XtreamChannel)> =
        channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .filter(channel_mappings::is_primary.eq(1))
            .select((channel_mappings::all_columns, xtream_channels::all_columns))
            .first(conn)
            .optional()
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(result.map(|(mapping, stream)| {
        let quality_tiers: Vec<String> = stream
            .qualities
            .as_ref()
            .and_then(|q| serde_json::from_str(q).ok())
            .unwrap_or_default();

        ChannelStreamInfo {
            stream_name: stream.name,
            quality_tiers,
            is_primary: mapping.is_primary.unwrap_or(0) == 1,
            match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
        }
    }))
}

/// Get program by ID with associated channel information.
pub fn get_program_by_id(
    conn: &mut SqliteConnection,
    program_id: i32,
) -> Result<Option<ProgramWithChannel>, EpgSourceError> {
    let result: Option<(Program, XmltvChannel)> = programs::table
        .inner_join(xmltv_channels::table)
        .filter(programs::id.eq(program_id))
        .select((programs::all_columns, xmltv_channels::all_columns))
        .first(conn)
        .optional()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(result.map(|(program, channel)| ProgramWithChannel {
        program: ProgramResponse::from(program),
        channel: ChannelInfo {
            id: channel.id.unwrap_or(0),
            display_name: channel.display_name,
            icon: channel.icon,
        },
    }))
}
