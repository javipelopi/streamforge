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
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Instant;
use uuid::Uuid;

use crate::xtream::quality::qualities_from_json;

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
        }
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

    /// Start a new streaming session
    ///
    /// Returns the session ID if successful, or None if connection limit reached
    pub fn start_session(&self, session: StreamSession) -> Option<String> {
        if !self.can_start_stream() {
            return None;
        }

        let session_id = Uuid::new_v4().to_string();
        self.active_sessions.insert(session_id.clone(), session);
        Some(session_id)
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
}
