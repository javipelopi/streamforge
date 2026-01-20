//! Stream failover module for automatic stream recovery
//!
//! This module implements the failover functionality (Story 4-5) that:
//! - Maintains failover state for each streaming session
//! - Provides backup stream lookup from channel_mappings
//! - Detects stream failures (timeout, connection error, HTTP error)
//! - Executes failover to backup streams in priority order
//! - Supports quality upgrade retry after recovery period (60s)
//! - Logs failover events to event_log table
//!
//! Security note: All error messages returned to clients are opaque
//! to avoid exposing internal details per FR33 requirements.

use diesel::prelude::*;
use std::time::{Duration, Instant};

use crate::db::schema::{accounts, channel_mappings, xtream_channels};
use crate::db::DbPooledConnection;
use crate::xtream::quality::qualities_from_json;

/// Timeout for stream read operations (5 seconds per AC #1)
pub const STREAM_READ_TIMEOUT: Duration = Duration::from_secs(5);

/// Connect timeout for each backup stream attempt (1s for aggressive failover)
pub const FAILOVER_CONNECT_TIMEOUT: Duration = Duration::from_secs(1);

/// Total timeout for failover operation (2s per NFR2)
pub const FAILOVER_TOTAL_TIMEOUT: Duration = Duration::from_secs(2);

/// Recovery period before attempting quality upgrade (60s per AC #3)
pub const QUALITY_UPGRADE_RECOVERY_PERIOD: Duration = Duration::from_secs(60);

/// Maximum backup attempts within the failover window
pub const MAX_FAILOVER_ATTEMPTS: usize = 2;

/// Represents an available backup stream for failover
#[derive(Debug, Clone)]
pub struct BackupStream {
    /// ID from xtream_channels table
    pub xtream_channel_id: i32,
    /// Stream ID for Xtream URL
    pub stream_id: i32,
    /// Priority order for failover (lower = higher priority)
    pub stream_priority: i32,
    /// Available quality levels JSON (e.g., ["4K", "HD", "SD"])
    pub qualities: Vec<String>,
    /// Xtream server base URL
    pub server_url: String,
    /// Account username
    pub username: String,
    /// Encrypted password blob
    pub password_encrypted: Vec<u8>,
    /// Account ID for credential decryption
    pub account_id: i32,
}

/// Maintains failover state for an active streaming session
#[derive(Debug)]
pub struct FailoverState {
    /// XMLTV channel being streamed
    pub xmltv_channel_id: i32,
    /// Index of currently active stream in available_streams
    pub current_stream_idx: usize,
    /// All available streams ordered by priority
    pub available_streams: Vec<BackupStream>,
    /// Time of last failover (for upgrade retry timing)
    pub last_failover_at: Option<Instant>,
    /// Count of failovers in this session
    pub failover_count: u32,
    /// Original primary stream ID (for upgrade retry)
    pub original_stream_id: i32,
}

impl FailoverState {
    /// Create a new FailoverState with the given streams
    ///
    /// Streams should already be sorted by stream_priority ASC, is_primary DESC
    pub fn new(xmltv_channel_id: i32, available_streams: Vec<BackupStream>) -> Self {
        let original_stream_id = available_streams
            .first()
            .map(|s| s.stream_id)
            .unwrap_or(0);

        Self {
            xmltv_channel_id,
            current_stream_idx: 0,
            available_streams,
            last_failover_at: None,
            failover_count: 0,
            original_stream_id,
        }
    }

    /// Get the currently active stream
    pub fn current_stream(&self) -> Option<&BackupStream> {
        self.available_streams.get(self.current_stream_idx)
    }

    /// Check if there are more backup streams available
    pub fn has_more_backups(&self) -> bool {
        self.current_stream_idx + 1 < self.available_streams.len()
    }

    /// Move to the next backup stream
    ///
    /// Returns true if successfully moved to next stream, false if no more streams
    pub fn advance_to_next_stream(&mut self) -> bool {
        if self.has_more_backups() {
            self.current_stream_idx += 1;
            self.last_failover_at = Some(Instant::now());
            self.failover_count += 1;
            true
        } else {
            false
        }
    }

    /// Check if we should attempt to upgrade back to primary/higher quality
    ///
    /// Returns true if:
    /// - We're on a backup stream (not primary)
    /// - At least 60 seconds have passed since last failover
    pub fn should_attempt_upgrade(&self) -> bool {
        // Only attempt upgrade if we're on a backup (not primary)
        if self.current_stream_idx == 0 {
            return false;
        }

        match self.last_failover_at {
            Some(time) => time.elapsed() >= QUALITY_UPGRADE_RECOVERY_PERIOD,
            None => false,
        }
    }

    /// Reset the upgrade timer after a failed upgrade attempt
    pub fn reset_upgrade_timer(&mut self) {
        self.last_failover_at = Some(Instant::now());
    }

    /// Attempt to upgrade to primary stream
    ///
    /// Returns true if we can try the primary stream again
    pub fn try_upgrade_to_primary(&mut self) -> bool {
        if self.current_stream_idx > 0 && !self.available_streams.is_empty() {
            // We'll try primary (index 0)
            true
        } else {
            false
        }
    }

    /// Complete upgrade to primary stream
    pub fn complete_upgrade_to_primary(&mut self) {
        self.current_stream_idx = 0;
        self.last_failover_at = None;
    }

    /// Check if currently on backup stream
    pub fn is_on_backup(&self) -> bool {
        self.current_stream_idx > 0
    }

    /// Get failover count for this session
    pub fn get_failover_count(&self) -> u32 {
        self.failover_count
    }

    /// Get the total number of available streams
    pub fn stream_count(&self) -> usize {
        self.available_streams.len()
    }
}

/// Reason why a stream failed
#[derive(Debug, Clone)]
pub enum FailureReason {
    /// 5-second timeout waiting for connection
    ConnectionTimeout,
    /// Network/DNS/connection error
    ConnectionError(String),
    /// Non-2xx HTTP status code
    HttpError(u16),
    /// Error reading stream body
    StreamError(String),
}

impl std::fmt::Display for FailureReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FailureReason::ConnectionTimeout => write!(f, "ConnectionTimeout"),
            FailureReason::ConnectionError(msg) => write!(f, "ConnectionError: {}", msg),
            FailureReason::HttpError(code) => write!(f, "HttpError: {}", code),
            FailureReason::StreamError(msg) => write!(f, "StreamError: {}", msg),
        }
    }
}

impl FailureReason {
    /// Determine the failure reason from a reqwest error
    ///
    /// Maps reqwest error types to our FailureReason variants:
    /// - Timeout errors -> ConnectionTimeout
    /// - Connection/network errors -> ConnectionError
    /// - Other errors -> StreamError
    pub fn from_reqwest_error(error: &reqwest::Error) -> Self {
        if error.is_timeout() {
            FailureReason::ConnectionTimeout
        } else if error.is_connect() {
            FailureReason::ConnectionError(error.to_string())
        } else if error.is_request() || error.is_redirect() {
            FailureReason::ConnectionError(error.to_string())
        } else {
            // Body/decode errors are stream errors
            FailureReason::StreamError(error.to_string())
        }
    }

    /// Determine failure reason from HTTP status code
    ///
    /// Called when the HTTP response status is non-2xx
    pub fn from_http_status(status: reqwest::StatusCode) -> Self {
        FailureReason::HttpError(status.as_u16())
    }

    /// Check if this failure reason indicates an account-level issue
    ///
    /// Account-level failures (e.g., HTTP 401/403) should skip other streams
    /// from the same account during failover.
    pub fn is_account_level_failure(&self) -> bool {
        matches!(self, FailureReason::HttpError(401 | 403))
    }
}

/// Error type for failover operations
#[derive(Debug)]
pub enum FailoverError {
    /// No more backup streams available
    AllStreamsExhausted,
    /// Database error during backup lookup
    DatabaseError(String),
    /// Credential decryption failed
    CredentialError(String),
    /// Timeout exceeded for failover operation
    TimeoutExceeded,
}

impl std::fmt::Display for FailoverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FailoverError::AllStreamsExhausted => write!(f, "All streams exhausted"),
            FailoverError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            FailoverError::CredentialError(msg) => write!(f, "Credential error: {}", msg),
            FailoverError::TimeoutExceeded => write!(f, "Failover timeout exceeded"),
        }
    }
}

impl std::error::Error for FailoverError {}

/// Get all backup streams for an XMLTV channel, ordered by priority
///
/// Queries the database for all stream mappings for the given XMLTV channel,
/// joining with xtream_channels and accounts to get full stream information.
///
/// Streams are ordered by:
/// 1. stream_priority ASC (lower = higher priority)
/// 2. is_primary DESC (primary streams first among equal priority)
///
/// Only includes streams from active accounts (is_active = 1).
///
/// Returns empty Vec if no mappings exist (caller handles this case).
pub fn get_all_streams_for_channel(
    conn: &mut DbPooledConnection,
    xmltv_channel_id: i32,
) -> Result<Vec<BackupStream>, FailoverError> {
    // Query for all stream mappings with account info
    // ORDER BY stream_priority ASC, is_primary DESC ensures:
    // - Lower priority numbers tried first
    // - Primary streams tried first among equal priority
    let results: Vec<(
        i32,           // xtream_channel_id
        i32,           // stream_id
        Option<i32>,   // stream_priority
        Option<String>, // qualities JSON
        String,        // server_url
        String,        // username
        Vec<u8>,       // password_encrypted
        i32,           // account_id
    )> = channel_mappings::table
        .inner_join(
            xtream_channels::table
                .on(channel_mappings::xtream_channel_id.eq(xtream_channels::id.assume_not_null())),
        )
        .inner_join(
            accounts::table.on(xtream_channels::account_id.eq(accounts::id.assume_not_null())),
        )
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .filter(accounts::is_active.eq(1))
        .order((
            channel_mappings::stream_priority.asc(),
            channel_mappings::is_primary.desc(),
        ))
        .select((
            xtream_channels::id.assume_not_null(),
            xtream_channels::stream_id,
            channel_mappings::stream_priority,
            xtream_channels::qualities,
            accounts::server_url,
            accounts::username,
            accounts::password_encrypted,
            accounts::id.assume_not_null(),
        ))
        .load(conn)
        .map_err(|e| {
            eprintln!("Failover - database query failed: {}", e);
            FailoverError::DatabaseError(e.to_string())
        })?;

    // Convert to BackupStream structs
    let streams = results
        .into_iter()
        .map(
            |(
                xtream_channel_id,
                stream_id,
                stream_priority,
                qualities_json,
                server_url,
                username,
                password_encrypted,
                account_id,
            )| {
                let qualities = qualities_json
                    .as_deref()
                    .map(|q| qualities_from_json(q))
                    .unwrap_or_default();

                BackupStream {
                    xtream_channel_id,
                    stream_id,
                    stream_priority: stream_priority.unwrap_or(0),
                    qualities,
                    server_url,
                    username,
                    password_encrypted,
                    account_id,
                }
            },
        )
        .collect();

    Ok(streams)
}

/// Log a failover event to the event_log table
///
/// Logs with level "warn" for successful failover, "error" for all streams exhausted.
/// Details include channel_id, from_stream_id, to_stream_id, reason, and timestamp.
pub fn log_failover_event(
    conn: &mut DbPooledConnection,
    channel_id: i32,
    from_stream_id: i32,
    to_stream_id: Option<i32>,
    reason: &FailureReason,
) -> Result<(), diesel::result::Error> {
    use crate::db::schema::event_log::dsl::*;

    let level_str = if to_stream_id.is_some() {
        "warn"
    } else {
        "error"
    };

    let message_str = if to_stream_id.is_some() {
        format!("Stream failover for channel {}", channel_id)
    } else {
        format!("All streams failed for channel {}", channel_id)
    };

    let details_json = serde_json::json!({
        "channel_id": channel_id,
        "from_stream_id": from_stream_id,
        "to_stream_id": to_stream_id,
        "reason": format!("{:?}", reason),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    diesel::insert_into(event_log)
        .values((
            timestamp.eq(chrono::Utc::now().to_rfc3339()),
            level.eq(level_str),
            category.eq("stream"),
            message.eq(&message_str),
            details.eq(details_json.to_string()),
            is_read.eq(0),
        ))
        .execute(conn)?;

    eprintln!(
        "Failover event - {}: {} (from: {}, to: {:?}, reason: {})",
        level_str, message_str, from_stream_id, to_stream_id, reason
    );

    Ok(())
}

/// Log a quality upgrade event to the event_log table
pub fn log_upgrade_event(
    conn: &mut DbPooledConnection,
    channel_id: i32,
    from_stream_id: i32,
    to_stream_id: i32,
    success: bool,
) -> Result<(), diesel::result::Error> {
    use crate::db::schema::event_log::dsl::*;

    let level_str = if success { "info" } else { "warn" };
    let message_str = if success {
        format!(
            "Quality upgrade successful for channel {} (stream {} -> {})",
            channel_id, from_stream_id, to_stream_id
        )
    } else {
        format!(
            "Quality upgrade failed for channel {} (staying on stream {})",
            channel_id, from_stream_id
        )
    };

    let details_json = serde_json::json!({
        "channel_id": channel_id,
        "from_stream_id": from_stream_id,
        "to_stream_id": to_stream_id,
        "success": success,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    diesel::insert_into(event_log)
        .values((
            timestamp.eq(chrono::Utc::now().to_rfc3339()),
            level.eq(level_str),
            category.eq("stream"),
            message.eq(&message_str),
            details.eq(details_json.to_string()),
            is_read.eq(0),
        ))
        .execute(conn)?;

    eprintln!("Upgrade event - {}: {}", level_str, message_str);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to create test BackupStream
    fn create_test_stream(stream_id: i32, priority: i32) -> BackupStream {
        BackupStream {
            xtream_channel_id: stream_id,
            stream_id,
            stream_priority: priority,
            qualities: vec!["HD".to_string(), "SD".to_string()],
            server_url: format!("http://test-{}.local:8080", stream_id),
            username: "testuser".to_string(),
            password_encrypted: vec![],
            account_id: 1,
        }
    }

    // =========================================================================
    // BackupStream Tests
    // =========================================================================

    #[test]
    fn test_backup_stream_creation() {
        let stream = create_test_stream(100, 0);
        assert_eq!(stream.stream_id, 100);
        assert_eq!(stream.stream_priority, 0);
        assert_eq!(stream.qualities.len(), 2);
    }

    // =========================================================================
    // FailoverState Tests
    // =========================================================================

    #[test]
    fn test_failover_state_creation() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
            create_test_stream(102, 2),
        ];
        let state = FailoverState::new(1, streams);

        assert_eq!(state.xmltv_channel_id, 1);
        assert_eq!(state.current_stream_idx, 0);
        assert_eq!(state.failover_count, 0);
        assert_eq!(state.original_stream_id, 100);
        assert!(state.last_failover_at.is_none());
    }

    #[test]
    fn test_failover_state_empty_streams() {
        let state = FailoverState::new(1, vec![]);

        assert_eq!(state.stream_count(), 0);
        assert!(state.current_stream().is_none());
        assert!(!state.has_more_backups());
    }

    #[test]
    fn test_current_stream() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let state = FailoverState::new(1, streams);

        let current = state.current_stream().unwrap();
        assert_eq!(current.stream_id, 100);
    }

    #[test]
    fn test_has_more_backups() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let mut state = FailoverState::new(1, streams);

        assert!(state.has_more_backups());

        state.advance_to_next_stream();
        assert!(!state.has_more_backups());
    }

    #[test]
    fn test_advance_to_next_stream() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
            create_test_stream(102, 2),
        ];
        let mut state = FailoverState::new(1, streams);

        assert_eq!(state.current_stream_idx, 0);
        assert_eq!(state.failover_count, 0);

        assert!(state.advance_to_next_stream());
        assert_eq!(state.current_stream_idx, 1);
        assert_eq!(state.failover_count, 1);
        assert!(state.last_failover_at.is_some());

        assert!(state.advance_to_next_stream());
        assert_eq!(state.current_stream_idx, 2);
        assert_eq!(state.failover_count, 2);

        // No more streams
        assert!(!state.advance_to_next_stream());
        assert_eq!(state.current_stream_idx, 2);
        assert_eq!(state.failover_count, 2);
    }

    #[test]
    fn test_is_on_backup() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let mut state = FailoverState::new(1, streams);

        assert!(!state.is_on_backup());

        state.advance_to_next_stream();
        assert!(state.is_on_backup());
    }

    #[test]
    fn test_should_attempt_upgrade_on_primary() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let state = FailoverState::new(1, streams);

        // On primary - should not attempt upgrade
        assert!(!state.should_attempt_upgrade());
    }

    #[test]
    fn test_should_attempt_upgrade_before_recovery_period() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let mut state = FailoverState::new(1, streams);

        state.advance_to_next_stream();

        // Just failed over - should not attempt upgrade yet
        assert!(!state.should_attempt_upgrade());
    }

    #[test]
    fn test_complete_upgrade_to_primary() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let mut state = FailoverState::new(1, streams);

        state.advance_to_next_stream();
        assert_eq!(state.current_stream_idx, 1);

        state.complete_upgrade_to_primary();
        assert_eq!(state.current_stream_idx, 0);
        assert!(state.last_failover_at.is_none());
    }

    #[test]
    fn test_reset_upgrade_timer() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let mut state = FailoverState::new(1, streams);

        state.advance_to_next_stream();
        let first_failover = state.last_failover_at.unwrap();

        // Simulate waiting
        std::thread::sleep(Duration::from_millis(10));

        state.reset_upgrade_timer();
        let reset_time = state.last_failover_at.unwrap();

        assert!(reset_time > first_failover);
    }

    #[test]
    fn test_get_failover_count() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
            create_test_stream(102, 2),
        ];
        let mut state = FailoverState::new(1, streams);

        assert_eq!(state.get_failover_count(), 0);

        state.advance_to_next_stream();
        assert_eq!(state.get_failover_count(), 1);

        state.advance_to_next_stream();
        assert_eq!(state.get_failover_count(), 2);
    }

    // =========================================================================
    // FailureReason Tests
    // =========================================================================

    #[test]
    fn test_failure_reason_display() {
        assert_eq!(
            format!("{}", FailureReason::ConnectionTimeout),
            "ConnectionTimeout"
        );
        assert_eq!(
            format!("{}", FailureReason::ConnectionError("DNS failed".to_string())),
            "ConnectionError: DNS failed"
        );
        assert_eq!(
            format!("{}", FailureReason::HttpError(404)),
            "HttpError: 404"
        );
        assert_eq!(
            format!("{}", FailureReason::StreamError("read failed".to_string())),
            "StreamError: read failed"
        );
    }

    #[test]
    fn test_failure_reason_from_http_status() {
        let reason = FailureReason::from_http_status(reqwest::StatusCode::NOT_FOUND);
        match reason {
            FailureReason::HttpError(code) => assert_eq!(code, 404),
            _ => panic!("Expected HttpError"),
        }

        let reason = FailureReason::from_http_status(reqwest::StatusCode::INTERNAL_SERVER_ERROR);
        match reason {
            FailureReason::HttpError(code) => assert_eq!(code, 500),
            _ => panic!("Expected HttpError"),
        }
    }

    #[test]
    fn test_failure_reason_is_account_level_failure() {
        // 401 and 403 are account-level failures
        assert!(FailureReason::HttpError(401).is_account_level_failure());
        assert!(FailureReason::HttpError(403).is_account_level_failure());

        // Other errors are not account-level
        assert!(!FailureReason::HttpError(404).is_account_level_failure());
        assert!(!FailureReason::HttpError(500).is_account_level_failure());
        assert!(!FailureReason::ConnectionTimeout.is_account_level_failure());
        assert!(!FailureReason::ConnectionError("test".to_string()).is_account_level_failure());
        assert!(!FailureReason::StreamError("test".to_string()).is_account_level_failure());
    }

    // =========================================================================
    // FailoverError Tests
    // =========================================================================

    #[test]
    fn test_failover_error_display() {
        assert_eq!(
            format!("{}", FailoverError::AllStreamsExhausted),
            "All streams exhausted"
        );
        assert_eq!(
            format!("{}", FailoverError::DatabaseError("connection failed".to_string())),
            "Database error: connection failed"
        );
        assert_eq!(
            format!("{}", FailoverError::CredentialError("decrypt failed".to_string())),
            "Credential error: decrypt failed"
        );
        assert_eq!(
            format!("{}", FailoverError::TimeoutExceeded),
            "Failover timeout exceeded"
        );
    }

    // =========================================================================
    // Constant Value Tests
    // =========================================================================

    #[test]
    fn test_stream_read_timeout_is_5_seconds() {
        assert_eq!(STREAM_READ_TIMEOUT, Duration::from_secs(5));
    }

    #[test]
    fn test_failover_connect_timeout_is_1_second() {
        assert_eq!(FAILOVER_CONNECT_TIMEOUT, Duration::from_secs(1));
    }

    #[test]
    fn test_failover_total_timeout_is_2_seconds() {
        assert_eq!(FAILOVER_TOTAL_TIMEOUT, Duration::from_secs(2));
    }

    #[test]
    fn test_quality_upgrade_recovery_is_60_seconds() {
        assert_eq!(QUALITY_UPGRADE_RECOVERY_PERIOD, Duration::from_secs(60));
    }

    #[test]
    fn test_max_failover_attempts_is_2() {
        assert_eq!(MAX_FAILOVER_ATTEMPTS, 2);
    }

    // =========================================================================
    // Stream Ordering Tests
    // =========================================================================

    #[test]
    fn test_streams_tried_in_priority_order() {
        let streams = vec![
            create_test_stream(100, 0), // Priority 0 (primary)
            create_test_stream(101, 1), // Priority 1
            create_test_stream(102, 2), // Priority 2
        ];
        let mut state = FailoverState::new(1, streams);

        // First stream should be priority 0
        assert_eq!(state.current_stream().unwrap().stream_priority, 0);

        // After failover, should be priority 1
        state.advance_to_next_stream();
        assert_eq!(state.current_stream().unwrap().stream_priority, 1);

        // After second failover, should be priority 2
        state.advance_to_next_stream();
        assert_eq!(state.current_stream().unwrap().stream_priority, 2);
    }

    #[test]
    fn test_all_streams_exhausted_returns_none() {
        let streams = vec![create_test_stream(100, 0)];
        let mut state = FailoverState::new(1, streams);

        // Advance past the only stream
        assert!(!state.advance_to_next_stream());

        // Current stream should still be the last one
        assert!(state.current_stream().is_some());
        assert!(!state.has_more_backups());
    }

    #[test]
    fn test_try_upgrade_to_primary_on_backup() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let mut state = FailoverState::new(1, streams);

        // On primary - can't upgrade
        assert!(!state.try_upgrade_to_primary());

        // Move to backup
        state.advance_to_next_stream();

        // Now can try upgrade
        assert!(state.try_upgrade_to_primary());
    }
}
