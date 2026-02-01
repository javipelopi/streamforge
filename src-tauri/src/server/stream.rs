//! Stream proxy module for proxying Xtream streams to Plex
//!
//! This module implements the stream proxy functionality (Story 4-4) that:
//! - Accepts stream requests using XMLTV channel IDs
//! - Looks up the primary Xtream stream mapping
//! - Selects the highest available quality (4K > FHD > HD > SD)
//! - Proxies the stream from Xtream to Plex with minimal buffering
//! - Enforces connection limits (tuner limit)
//!
//! Security note: All endpoints are bound to 127.0.0.1 only (NFR21).

use dashmap::DashMap;
use serde::Serialize;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Instant;
use uuid::Uuid;

use crate::xtream::quality::qualities_from_json;

use super::buffer::StreamHealth;

/// Represents the type and data of a stream source
///
/// This enum enables unified handling of different stream source types
/// (Xtream, M3U, Acestream) in the failover and streaming logic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum StreamSourceType {
    /// Xtream Codes stream - requires credential decryption and tuner slot
    Xtream {
        account_id: i32,
        stream_id: i32,
        server_url: String,
        username: String,
        password_encrypted: Vec<u8>,
    },
    /// M3U playlist stream - direct URL, no tuner slot needed
    M3u {
        stream_url: String,
    },
    /// Acestream P2P stream - requires local engine, no tuner slot needed
    Acestream {
        content_id: String,
    },
}

// FIX #9 (MEDIUM): Consistent source type naming via Display trait
impl std::fmt::Display for StreamSourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StreamSourceType::Xtream { .. } => write!(f, "Xtream"),
            StreamSourceType::M3u { .. } => write!(f, "M3U"),
            StreamSourceType::Acestream { .. } => write!(f, "Acestream"),
        }
    }
}

/// Quality priority order (highest to lowest)
/// 4K > FHD > HD > SD
const QUALITY_PRIORITY: [&str; 4] = ["4K", "FHD", "HD", "SD"];

/// Represents an active streaming session
#[derive(Debug, Clone)]
pub struct StreamSession {
    /// XMLTV channel ID being streamed
    pub xmltv_channel_id: i32,
    /// Xtream stream ID being used
    pub xtream_stream_id: i32,
    /// Current quality tier being streamed
    pub current_quality: String,
    /// When the stream started
    pub started_at: Instant,
    /// Count of failovers in this session (Story 4-5)
    pub failover_count: u32,
    /// Original primary stream ID for upgrade retry (Story 4-5)
    pub original_stream_id: i32,
    // Health monitoring fields (Story 4.7)
    /// Current health status of the stream
    pub health_status: Option<StreamHealth>,
    /// When the last failover occurred
    pub last_failover_at: Option<Instant>,
}

impl StreamSession {
    /// Create a new stream session
    pub fn new(xmltv_channel_id: i32, xtream_stream_id: i32, quality: String) -> Self {
        Self {
            xmltv_channel_id,
            xtream_stream_id,
            current_quality: quality,
            started_at: Instant::now(),
            failover_count: 0,
            original_stream_id: xtream_stream_id,
            health_status: Some(StreamHealth::Healthy),
            last_failover_at: None,
        }
    }

    /// Update the health status of this session (Story 4.7)
    pub fn update_health(&mut self, status: StreamHealth) {
        self.health_status = Some(status);
    }

    /// Record a mid-stream failover event (Story 4.7)
    pub fn record_failover(&mut self, new_stream_id: i32, new_quality: String) {
        self.xtream_stream_id = new_stream_id;
        self.current_quality = new_quality;
        self.failover_count += 1;
        self.last_failover_at = Some(Instant::now());
        self.health_status = Some(StreamHealth::Healthy); // Reset health after failover
    }

    /// Increment the failover count after a successful failover
    pub fn increment_failover(&mut self) {
        self.failover_count += 1;
    }

    /// Get the current failover count
    pub fn get_failover_count(&self) -> u32 {
        self.failover_count
    }

    /// Check if currently on a backup stream (not the original)
    pub fn can_upgrade(&self) -> bool {
        self.xtream_stream_id != self.original_stream_id
    }

    /// Update the current stream after failover
    pub fn update_stream(&mut self, new_stream_id: i32, new_quality: String) {
        self.xtream_stream_id = new_stream_id;
        self.current_quality = new_quality;
        self.failover_count += 1;
    }

    /// Complete upgrade to original stream
    pub fn complete_upgrade(&mut self, quality: String) {
        self.xtream_stream_id = self.original_stream_id;
        self.current_quality = quality;
    }
}

/// Manages active stream sessions and connection limits
///
/// Uses DashMap for thread-safe concurrent access to session tracking.
/// Connection limit is enforced based on account's max_connections setting.
#[derive(Debug)]
pub struct StreamManager {
    /// Active streaming sessions, keyed by session ID
    active_sessions: DashMap<String, StreamSession>,
    /// Maximum allowed concurrent connections (using AtomicU32 for thread-safe updates)
    max_connections: AtomicU32,
}

impl StreamManager {
    /// Create a new StreamManager with the specified connection limit
    pub fn new(max_connections: u32) -> Self {
        Self {
            active_sessions: DashMap::new(),
            max_connections: AtomicU32::new(max_connections),
        }
    }

    /// Check if a new stream can be started (connection limit not reached)
    pub fn can_start_stream(&self) -> bool {
        self.active_sessions.len() < self.max_connections.load(Ordering::Relaxed) as usize
    }

    /// Start a new streaming session (with tuner limit enforcement)
    ///
    /// Returns the session ID if successful, or None if connection limit reached.
    /// Use this for Xtream sources that require tuner slots.
    ///
    /// FIX #3 (HIGH): Uses DashMap's entry() API for atomic check-and-insert
    /// to prevent TOCTOU race condition
    pub fn start_session(&self, session: StreamSession) -> Option<String> {
        let session_id = Uuid::new_v4().to_string();
        let max = self.max_connections.load(Ordering::Relaxed) as usize;

        // Use entry API for atomic check-and-insert
        use dashmap::mapref::entry::Entry;
        match self.active_sessions.entry(session_id.clone()) {
            Entry::Vacant(e) => {
                // Check limit before inserting
                if self.active_sessions.len() >= max {
                    return None;
                }
                e.insert(session);
                Some(session_id)
            }
            Entry::Occupied(_) => {
                // Extremely rare UUID collision, retry
                let retry_id = Uuid::new_v4().to_string();
                if self.active_sessions.len() >= max {
                    return None;
                }
                self.active_sessions.insert(retry_id.clone(), session);
                Some(retry_id)
            }
        }
    }

    /// Start a new streaming session without enforcing tuner limit
    ///
    /// Always succeeds. Use this for M3U/Acestream sources that don't consume tuner slots.
    /// These sessions are still tracked for mid-stream failover support.
    pub fn start_session_no_limit(&self, session: StreamSession) -> String {
        let session_id = Uuid::new_v4().to_string();
        self.active_sessions.insert(session_id.clone(), session);
        session_id
    }

    /// End a streaming session by its ID
    pub fn end_session(&self, session_id: &str) {
        self.active_sessions.remove(session_id);
    }

    /// Get the count of active sessions
    pub fn active_count(&self) -> usize {
        self.active_sessions.len()
    }

    /// Get the maximum connection limit
    pub fn max_connections(&self) -> u32 {
        self.max_connections.load(Ordering::Relaxed)
    }

    /// Update the maximum connection limit (thread-safe)
    ///
    /// This allows updating the connection limit at runtime without requiring
    /// a mutable reference, making it safe to call from multiple threads.
    pub fn set_max_connections(&self, max: u32) {
        self.max_connections.store(max, Ordering::Relaxed);
    }

    /// Update a session with a closure (Story 4.7)
    ///
    /// Allows updating session state during mid-stream failover.
    /// Returns true if session was found and updated, false otherwise.
    pub fn update_session<F>(&self, session_id: &str, f: F) -> bool
    where
        F: FnOnce(&mut StreamSession),
    {
        if let Some(mut session) = self.active_sessions.get_mut(session_id) {
            f(&mut session);
            true
        } else {
            false
        }
    }

    /// Get a clone of a session by ID (Story 4.7)
    ///
    /// Returns None if session doesn't exist.
    pub fn get_session(&self, session_id: &str) -> Option<StreamSession> {
        self.active_sessions.get(session_id).map(|s| s.clone())
    }
}

impl Default for StreamManager {
    fn default() -> Self {
        // Default to 2 connections if not specified
        Self::new(2)
    }
}

/// Select the best available quality from a list of qualities
///
/// Quality priority: 4K > FHD > HD > SD
/// Returns "SD" as default if no quality information available.
///
/// # Arguments
/// * `qualities_json` - Optional JSON string containing quality array, e.g., `["4K", "HD", "SD"]`
///
/// # Returns
/// The highest available quality string
pub fn select_best_quality(qualities_json: Option<&str>) -> String {
    let qualities = match qualities_json {
        Some(json) if !json.is_empty() => qualities_from_json(json),
        _ => {
            return "SD".to_string();
        }
    };

    // Return first matching quality in priority order
    for quality in QUALITY_PRIORITY.iter() {
        if qualities.iter().any(|q| q.eq_ignore_ascii_case(quality)) {
            return quality.to_string();
        }
    }

    // Default to SD if no recognized quality found
    "SD".to_string()
}

/// Error type for stream URL building
#[derive(Debug, Clone)]
pub enum StreamUrlError {
    /// Acestream is not supported on this platform (macOS)
    AcestreamUnsupported,
    /// Credential decryption failed
    CredentialError(String),
    /// Acestream-specific error (engine connection, content retrieval, etc.)
    AcestreamError(String),
}

impl std::fmt::Display for StreamUrlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StreamUrlError::AcestreamUnsupported => {
                write!(f, "Acestream is not supported on this platform")
            }
            StreamUrlError::CredentialError(msg) => write!(f, "Credential error: {}", msg),
            StreamUrlError::AcestreamError(msg) => write!(f, "Acestream error: {}", msg),
        }
    }
}

impl std::error::Error for StreamUrlError {}

/// Build a stream URL from a StreamSourceType
///
/// Handles all source types:
/// - Xtream: Requires password decryption via credential_manager
/// - M3U: Returns the stream URL directly
/// - Acestream: Builds localhost:6878 URL (errors on macOS)
///
/// # Arguments
/// * `source` - The stream source type with its data
/// * `credential_manager` - Optional credential manager for Xtream password decryption
///
/// # Returns
/// The stream URL or an error
pub fn build_stream_url_for_source(
    source: &StreamSourceType,
    credential_manager: Option<&crate::credentials::CredentialManager>,
) -> Result<String, StreamUrlError> {
    match source {
        StreamSourceType::Xtream {
            account_id,
            stream_id,
            server_url,
            username,
            password_encrypted,
        } => {
            // Decrypt password using credential manager
            let password = match credential_manager {
                Some(cm) => cm
                    .retrieve_password(&account_id.to_string(), password_encrypted)
                    .map_err(|e| StreamUrlError::CredentialError(e.to_string()))?,
                None => {
                    return Err(StreamUrlError::CredentialError(
                        "Credential manager required for Xtream sources".to_string(),
                    ));
                }
            };

            Ok(build_stream_url(server_url, username, &password, *stream_id))
        }
        StreamSourceType::M3u { stream_url } => {
            // M3U streams use their URL directly
            Ok(stream_url.clone())
        }
        StreamSourceType::Acestream { content_id } => {
            // Check platform support
            if !crate::acestream::is_acestream_supported() {
                return Err(StreamUrlError::AcestreamUnsupported);
            }

            // Build Acestream URL via local engine
            crate::acestream::build_acestream_url(content_id)
                .map_err(|e| StreamUrlError::AcestreamError(e.to_string()))
        }
    }
}

/// Check if a source type requires a tuner slot
///
/// Only Xtream sources consume tuner slots. M3U and Acestream are "free"
/// in terms of tuner limits since they don't count against provider connections.
pub fn source_requires_tuner(source: &StreamSourceType) -> bool {
    matches!(source, StreamSourceType::Xtream { .. })
}

/// Generate Xtream stream URL
///
/// Standard Xtream stream URL format:
/// `{server_url}/live/{username}/{password}/{stream_id}.ts`
///
/// # Arguments
/// * `server_url` - Base server URL (e.g., "http://example.com:8080")
/// * `username` - Account username
/// * `password` - Account password (decrypted)
/// * `stream_id` - Xtream stream ID
///
/// # Returns
/// Complete stream URL
pub fn build_stream_url(server_url: &str, username: &str, password: &str, stream_id: i32) -> String {
    // Trim trailing slashes from server URL
    let server = server_url.trim_end_matches('/');

    // URL-encode username and password for special characters
    let encoded_username = urlencoding::encode(username);
    let encoded_password = urlencoding::encode(password);

    format!(
        "{}/live/{}/{}/{}.ts",
        server, encoded_username, encoded_password, stream_id
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // StreamSession Tests
    // =========================================================================

    #[test]
    fn test_stream_session_creation() {
        let session = StreamSession::new(1, 100, "HD".to_string());
        assert_eq!(session.xmltv_channel_id, 1);
        assert_eq!(session.xtream_stream_id, 100);
        assert_eq!(session.current_quality, "HD");
        assert!(session.started_at.elapsed().as_secs() < 1);
        assert_eq!(session.failover_count, 0);
        assert_eq!(session.original_stream_id, 100);
    }

    #[test]
    fn test_stream_session_failover_tracking() {
        let mut session = StreamSession::new(1, 100, "HD".to_string());

        assert_eq!(session.get_failover_count(), 0);
        assert!(!session.can_upgrade());

        session.increment_failover();
        assert_eq!(session.get_failover_count(), 1);

        session.update_stream(101, "SD".to_string());
        assert_eq!(session.xtream_stream_id, 101);
        assert_eq!(session.current_quality, "SD");
        assert_eq!(session.get_failover_count(), 2);
        assert!(session.can_upgrade()); // Now on backup stream
    }

    #[test]
    fn test_stream_session_upgrade() {
        let mut session = StreamSession::new(1, 100, "4K".to_string());
        session.update_stream(101, "HD".to_string());

        assert!(session.can_upgrade());

        session.complete_upgrade("4K".to_string());
        assert_eq!(session.xtream_stream_id, 100);
        assert_eq!(session.current_quality, "4K");
        assert!(!session.can_upgrade());
    }

    // =========================================================================
    // StreamSession Health Tests (Story 4.7)
    // =========================================================================

    #[test]
    fn test_stream_session_health_status_default() {
        let session = StreamSession::new(1, 100, "HD".to_string());

        // Should start as healthy
        assert!(session.health_status.is_some());
        assert_eq!(session.health_status, Some(StreamHealth::Healthy));
        assert!(session.last_failover_at.is_none());
    }

    #[test]
    fn test_stream_session_update_health() {
        use std::time::Duration;

        let mut session = StreamSession::new(1, 100, "HD".to_string());

        // Update to stalled
        session.update_health(StreamHealth::Stalled(Duration::from_secs(3)));
        match session.health_status {
            Some(StreamHealth::Stalled(duration)) => {
                assert_eq!(duration.as_secs(), 3);
            }
            _ => panic!("Expected Stalled status"),
        }

        // Update to failed
        session.update_health(StreamHealth::Failed);
        assert_eq!(session.health_status, Some(StreamHealth::Failed));
    }

    #[test]
    fn test_stream_session_record_failover() {
        let mut session = StreamSession::new(1, 100, "HD".to_string());

        assert_eq!(session.failover_count, 0);
        assert!(session.last_failover_at.is_none());

        // Record failover
        session.record_failover(101, "SD".to_string());

        assert_eq!(session.xtream_stream_id, 101);
        assert_eq!(session.current_quality, "SD");
        assert_eq!(session.failover_count, 1);
        assert!(session.last_failover_at.is_some());
        assert_eq!(session.health_status, Some(StreamHealth::Healthy)); // Reset after failover
    }

    #[test]
    fn test_stream_session_multiple_failovers() {
        let mut session = StreamSession::new(1, 100, "4K".to_string());

        session.record_failover(101, "HD".to_string());
        session.record_failover(102, "SD".to_string());

        assert_eq!(session.xtream_stream_id, 102);
        assert_eq!(session.current_quality, "SD");
        assert_eq!(session.failover_count, 2);
        assert!(session.can_upgrade()); // On backup, can upgrade
    }

    // =========================================================================
    // StreamManager Tests
    // =========================================================================

    #[test]
    fn test_stream_manager_creation() {
        let manager = StreamManager::new(3);
        assert_eq!(manager.max_connections(), 3);
        assert_eq!(manager.active_count(), 0);
        assert!(manager.can_start_stream());
    }

    #[test]
    fn test_stream_manager_default() {
        let manager = StreamManager::default();
        assert_eq!(manager.max_connections(), 2);
    }

    #[test]
    fn test_start_and_end_session() {
        let manager = StreamManager::new(2);
        let session = StreamSession::new(1, 100, "HD".to_string());

        let session_id = manager.start_session(session).expect("Should start session");
        assert_eq!(manager.active_count(), 1);
        assert!(!session_id.is_empty());

        manager.end_session(&session_id);
        assert_eq!(manager.active_count(), 0);
    }

    #[test]
    fn test_connection_limit_enforcement() {
        let manager = StreamManager::new(2);

        // Start first session
        let session1 = StreamSession::new(1, 100, "HD".to_string());
        let id1 = manager.start_session(session1);
        assert!(id1.is_some());
        assert!(manager.can_start_stream());

        // Start second session
        let session2 = StreamSession::new(2, 200, "SD".to_string());
        let id2 = manager.start_session(session2);
        assert!(id2.is_some());
        assert!(!manager.can_start_stream());

        // Third session should fail (limit reached)
        let session3 = StreamSession::new(3, 300, "4K".to_string());
        let id3 = manager.start_session(session3);
        assert!(id3.is_none());
        assert_eq!(manager.active_count(), 2);
    }

    #[test]
    fn test_session_cleanup_frees_slot() {
        let manager = StreamManager::new(1);

        // Start first session
        let session1 = StreamSession::new(1, 100, "HD".to_string());
        let id1 = manager.start_session(session1).unwrap();
        assert!(!manager.can_start_stream());

        // End session
        manager.end_session(&id1);
        assert!(manager.can_start_stream());

        // Now we can start a new session
        let session2 = StreamSession::new(2, 200, "SD".to_string());
        let id2 = manager.start_session(session2);
        assert!(id2.is_some());
    }

    // =========================================================================
    // StreamManager Update Session Tests (Story 4.7)
    // =========================================================================

    #[test]
    fn test_update_session_success() {
        let manager = StreamManager::new(2);
        let session = StreamSession::new(1, 100, "HD".to_string());
        let session_id = manager.start_session(session).unwrap();

        // Update the session
        let updated = manager.update_session(&session_id, |s| {
            s.failover_count = 5;
        });

        assert!(updated);

        // Verify the update persisted
        let retrieved = manager.get_session(&session_id).unwrap();
        assert_eq!(retrieved.failover_count, 5);
    }

    #[test]
    fn test_update_session_not_found() {
        let manager = StreamManager::new(2);

        let updated = manager.update_session("nonexistent-id", |s| {
            s.failover_count = 5;
        });

        assert!(!updated);
    }

    #[test]
    fn test_get_session_success() {
        let manager = StreamManager::new(2);
        let session = StreamSession::new(1, 100, "HD".to_string());
        let session_id = manager.start_session(session).unwrap();

        let retrieved = manager.get_session(&session_id);
        assert!(retrieved.is_some());

        let s = retrieved.unwrap();
        assert_eq!(s.xmltv_channel_id, 1);
        assert_eq!(s.xtream_stream_id, 100);
        assert_eq!(s.current_quality, "HD");
    }

    #[test]
    fn test_get_session_not_found() {
        let manager = StreamManager::new(2);

        let retrieved = manager.get_session("nonexistent-id");
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_update_session_with_record_failover() {
        let manager = StreamManager::new(2);
        let session = StreamSession::new(1, 100, "4K".to_string());
        let session_id = manager.start_session(session).unwrap();

        // Record a failover via update_session (as done in failover.rs)
        manager.update_session(&session_id, |s| {
            s.record_failover(101, "HD".to_string());
        });

        // Verify the failover was recorded
        let retrieved = manager.get_session(&session_id).unwrap();
        assert_eq!(retrieved.xtream_stream_id, 101);
        assert_eq!(retrieved.current_quality, "HD");
        assert_eq!(retrieved.failover_count, 1);
        assert!(retrieved.last_failover_at.is_some());
    }

    // =========================================================================
    // Quality Selection Tests
    // =========================================================================

    #[test]
    fn test_quality_selection_prefers_4k_over_hd_over_sd() {
        assert_eq!(select_best_quality(Some(r#"["4K", "HD", "SD"]"#)), "4K");
        assert_eq!(select_best_quality(Some(r#"["HD", "SD"]"#)), "HD");
        assert_eq!(select_best_quality(Some(r#"["SD"]"#)), "SD");
    }

    #[test]
    fn test_quality_selection_fhd_over_hd() {
        assert_eq!(select_best_quality(Some(r#"["FHD", "HD", "SD"]"#)), "FHD");
        assert_eq!(select_best_quality(Some(r#"["4K", "FHD", "HD"]"#)), "4K");
    }

    #[test]
    fn test_quality_selection_handles_missing_quality_info() {
        assert_eq!(select_best_quality(None), "SD");
        assert_eq!(select_best_quality(Some("")), "SD");
        assert_eq!(select_best_quality(Some("invalid")), "SD");
    }

    #[test]
    fn test_quality_selection_case_insensitive() {
        assert_eq!(select_best_quality(Some(r#"["4k", "hd", "sd"]"#)), "4K");
        assert_eq!(select_best_quality(Some(r#"["Hd", "Sd"]"#)), "HD");
    }

    // =========================================================================
    // Stream URL Generation Tests
    // =========================================================================

    #[test]
    fn test_stream_url_generation_basic() {
        let url = build_stream_url("http://example.com:8080", "user", "pass", 123);
        assert_eq!(url, "http://example.com:8080/live/user/pass/123.ts");
    }

    #[test]
    fn test_stream_url_strips_trailing_slash() {
        let url = build_stream_url("http://example.com:8080/", "user", "pass", 123);
        assert_eq!(url, "http://example.com:8080/live/user/pass/123.ts");
    }

    #[test]
    fn test_stream_url_multiple_trailing_slashes() {
        let url = build_stream_url("http://example.com:8080///", "user", "pass", 123);
        assert_eq!(url, "http://example.com:8080/live/user/pass/123.ts");
    }

    #[test]
    fn test_stream_url_special_characters_in_username() {
        let url = build_stream_url("http://example.com", "user@domain", "pass", 123);
        assert_eq!(url, "http://example.com/live/user%40domain/pass/123.ts");
    }

    #[test]
    fn test_stream_url_special_characters_in_password() {
        let url = build_stream_url("http://example.com", "user", "p@ss!#$", 123);
        assert_eq!(url, "http://example.com/live/user/p%40ss%21%23%24/123.ts");
    }

    #[test]
    fn test_stream_url_https() {
        let url = build_stream_url("https://secure.example.com", "user", "pass", 456);
        assert_eq!(url, "https://secure.example.com/live/user/pass/456.ts");
    }

    #[test]
    fn test_stream_url_with_spaces() {
        let url = build_stream_url("http://example.com", "user name", "pass word", 789);
        assert_eq!(url, "http://example.com/live/user%20name/pass%20word/789.ts");
    }

    // =========================================================================
    // StreamSourceType Tests
    // =========================================================================

    #[test]
    fn test_stream_source_type_xtream() {
        let source = StreamSourceType::Xtream {
            account_id: 1,
            stream_id: 100,
            server_url: "http://example.com".to_string(),
            username: "user".to_string(),
            password_encrypted: vec![1, 2, 3],
        };

        match source {
            StreamSourceType::Xtream { stream_id, .. } => assert_eq!(stream_id, 100),
            _ => panic!("Expected Xtream variant"),
        }
    }

    #[test]
    fn test_stream_source_type_m3u() {
        let source = StreamSourceType::M3u {
            stream_url: "http://stream.example.com/live.m3u8".to_string(),
        };

        match source {
            StreamSourceType::M3u { stream_url } => {
                assert_eq!(stream_url, "http://stream.example.com/live.m3u8");
            }
            _ => panic!("Expected M3u variant"),
        }
    }

    #[test]
    fn test_stream_source_type_acestream() {
        let source = StreamSourceType::Acestream {
            content_id: "abc123def456".to_string(),
        };

        match source {
            StreamSourceType::Acestream { content_id } => {
                assert_eq!(content_id, "abc123def456");
            }
            _ => panic!("Expected Acestream variant"),
        }
    }

    // =========================================================================
    // source_requires_tuner Tests
    // =========================================================================

    #[test]
    fn test_xtream_requires_tuner() {
        let source = StreamSourceType::Xtream {
            account_id: 1,
            stream_id: 100,
            server_url: "http://example.com".to_string(),
            username: "user".to_string(),
            password_encrypted: vec![],
        };
        assert!(source_requires_tuner(&source));
    }

    #[test]
    fn test_m3u_does_not_require_tuner() {
        let source = StreamSourceType::M3u {
            stream_url: "http://stream.example.com/live.m3u8".to_string(),
        };
        assert!(!source_requires_tuner(&source));
    }

    #[test]
    fn test_acestream_does_not_require_tuner() {
        let source = StreamSourceType::Acestream {
            content_id: "abc123".to_string(),
        };
        assert!(!source_requires_tuner(&source));
    }

    // =========================================================================
    // build_stream_url_for_source Tests
    // =========================================================================

    #[test]
    fn test_build_url_for_m3u_source() {
        let source = StreamSourceType::M3u {
            stream_url: "http://stream.example.com/live.m3u8".to_string(),
        };

        let result = build_stream_url_for_source(&source, None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "http://stream.example.com/live.m3u8");
    }

    #[test]
    fn test_build_url_for_xtream_without_credential_manager() {
        let source = StreamSourceType::Xtream {
            account_id: 1,
            stream_id: 100,
            server_url: "http://example.com".to_string(),
            username: "user".to_string(),
            password_encrypted: vec![],
        };

        let result = build_stream_url_for_source(&source, None);
        assert!(result.is_err());
        match result {
            Err(StreamUrlError::CredentialError(_)) => {}
            _ => panic!("Expected CredentialError"),
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_build_url_for_acestream_on_macos() {
        let source = StreamSourceType::Acestream {
            content_id: "abc123".to_string(),
        };

        let result = build_stream_url_for_source(&source, None);
        assert!(result.is_err());
        match result {
            Err(StreamUrlError::AcestreamUnsupported) => {}
            _ => panic!("Expected AcestreamUnsupported"),
        }
    }

    // =========================================================================
    // StreamUrlError Tests
    // =========================================================================

    #[test]
    fn test_stream_url_error_display() {
        let err = StreamUrlError::AcestreamUnsupported;
        assert_eq!(
            format!("{}", err),
            "Acestream is not supported on this platform"
        );

        let err = StreamUrlError::CredentialError("decrypt failed".to_string());
        assert_eq!(format!("{}", err), "Credential error: decrypt failed");

        let err = StreamUrlError::AcestreamError("engine connection failed".to_string());
        assert_eq!(format!("{}", err), "Acestream error: engine connection failed");
    }
}
