//! Stream failover module for automatic stream recovery
//!
//! This module implements the failover functionality (Story 4-5 and 4-7) that:
//! - Maintains failover state for each streaming session
//! - Provides backup stream lookup from channel_mappings
//! - Detects stream failures (timeout, connection error, HTTP error)
//! - Executes failover to backup streams in priority order
//! - Supports quality upgrade retry after recovery period (60s)
//! - Logs failover events to event_log table
//! - Provides FailoverStream for mid-stream failover (Story 4.7)
//!
//! Security note: All error messages returned to clients are opaque
//! to avoid exposing internal details per FR33 requirements.

use bytes::Bytes;
use diesel::prelude::*;
use futures_util::Stream;
use serde::{Deserialize, Serialize};
use std::io;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

use crate::db::schema::{accounts, acestream_sources, channel_mappings, m3u_channels, m3u_sources, xtream_channels};
use crate::db::DbPooledConnection;
use crate::xtream::quality::qualities_from_json;

use super::stream::StreamSourceType;

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

// ============================================================================
// Resilience Configuration (ip-6fj)
// ============================================================================

/// How strict the failover behavior should be
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FailoverStrictness {
    /// Current behavior - fail immediately, move to next stream
    Strict,
    /// 2 retries with 1s base backoff before failover (default)
    Balanced,
    /// 3 retries with 2s base backoff, periodic health checks to recover
    Lenient,
}

impl Default for FailoverStrictness {
    fn default() -> Self {
        Self::Balanced
    }
}

impl std::fmt::Display for FailoverStrictness {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Strict => write!(f, "strict"),
            Self::Balanced => write!(f, "balanced"),
            Self::Lenient => write!(f, "lenient"),
        }
    }
}

impl std::str::FromStr for FailoverStrictness {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "strict" => Ok(Self::Strict),
            "balanced" => Ok(Self::Balanced),
            "lenient" => Ok(Self::Lenient),
            _ => Err(format!("Unknown strictness level: {}", s)),
        }
    }
}

/// Configuration for resilient stream failover behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResilienceConfig {
    /// Strictness level controlling overall behavior
    pub strictness: FailoverStrictness,
    /// Number of retries on the same stream before moving to next
    pub max_retries: u32,
    /// Base backoff delay in milliseconds for retries
    pub backoff_base_ms: u64,
    /// Exponential multiplier for backoff (delay *= multiplier each retry)
    pub backoff_multiplier: f64,
    /// Maximum backoff delay cap in milliseconds
    pub backoff_max_ms: u64,
    /// Seconds between periodic health checks to restore original quality
    pub recovery_check_secs: u64,
    /// Whether to try same quality on different server endpoints before downgrading
    pub try_alternate_endpoints: bool,
}

impl Default for ResilienceConfig {
    fn default() -> Self {
        Self::from_strictness(FailoverStrictness::default())
    }
}

impl ResilienceConfig {
    /// Create a config from a strictness preset
    pub fn from_strictness(strictness: FailoverStrictness) -> Self {
        match strictness {
            FailoverStrictness::Strict => Self {
                strictness,
                max_retries: 0,
                backoff_base_ms: 0,
                backoff_multiplier: 1.0,
                backoff_max_ms: 0,
                recovery_check_secs: 0, // No periodic recovery
                try_alternate_endpoints: false,
            },
            FailoverStrictness::Balanced => Self {
                strictness,
                max_retries: 2,
                backoff_base_ms: 1000,
                backoff_multiplier: 2.0,
                backoff_max_ms: 4000,
                recovery_check_secs: 60,
                try_alternate_endpoints: true,
            },
            FailoverStrictness::Lenient => Self {
                strictness,
                max_retries: 3,
                backoff_base_ms: 2000,
                backoff_multiplier: 2.0,
                backoff_max_ms: 10000,
                recovery_check_secs: 30,
                try_alternate_endpoints: true,
            },
        }
    }

    /// Load resilience config from database settings
    pub fn from_db(conn: &mut DbPooledConnection) -> Self {
        use crate::db::schema::settings;

        let strictness_str: Option<String> = settings::table
            .filter(settings::key.eq("failover_strictness"))
            .select(settings::value)
            .first(conn)
            .optional()
            .ok()
            .flatten();

        let strictness = strictness_str
            .and_then(|s| s.parse::<FailoverStrictness>().ok())
            .unwrap_or_default();

        // Start with preset, then override with any custom settings
        let mut config = Self::from_strictness(strictness);

        // Override max_retries if explicitly set
        if let Some(val) = Self::read_setting_u32(conn, "failover_max_retries") {
            config.max_retries = val;
        }

        // Override recovery_check_secs if explicitly set
        if let Some(val) = Self::read_setting_u64(conn, "failover_recovery_check_secs") {
            config.recovery_check_secs = val;
        }

        config
    }

    fn read_setting_u32(conn: &mut DbPooledConnection, key: &str) -> Option<u32> {
        use crate::db::schema::settings;
        settings::table
            .filter(settings::key.eq(key))
            .select(settings::value)
            .first::<String>(conn)
            .optional()
            .ok()
            .flatten()
            .and_then(|s| s.parse().ok())
    }

    fn read_setting_u64(conn: &mut DbPooledConnection, key: &str) -> Option<u64> {
        use crate::db::schema::settings;
        settings::table
            .filter(settings::key.eq(key))
            .select(settings::value)
            .first::<String>(conn)
            .optional()
            .ok()
            .flatten()
            .and_then(|s| s.parse().ok())
    }

    /// Calculate backoff delay for a given retry attempt (0-indexed)
    pub fn backoff_delay(&self, attempt: u32) -> Duration {
        if self.backoff_base_ms == 0 {
            return Duration::ZERO;
        }
        let delay_ms = (self.backoff_base_ms as f64)
            * self.backoff_multiplier.powi(attempt as i32);
        let capped_ms = delay_ms.min(self.backoff_max_ms as f64) as u64;
        Duration::from_millis(capped_ms)
    }

    /// Whether retries are enabled
    pub fn retries_enabled(&self) -> bool {
        self.max_retries > 0
    }

    /// Whether periodic recovery checks are enabled
    pub fn recovery_enabled(&self) -> bool {
        self.recovery_check_secs > 0
    }

    /// Get the recovery period as a Duration
    pub fn recovery_period(&self) -> Duration {
        if self.recovery_check_secs > 0 {
            Duration::from_secs(self.recovery_check_secs)
        } else {
            QUALITY_UPGRADE_RECOVERY_PERIOD
        }
    }

    /// Check if a failure reason is transient (worth retrying)
    pub fn is_transient_failure(reason: &FailureReason) -> bool {
        matches!(
            reason,
            FailureReason::ConnectionTimeout
                | FailureReason::ConnectionError(_)
                | FailureReason::StreamError(_)
        )
    }
}

/// Represents an available backup stream for failover
///
/// Updated for multi-source support: now uses StreamSourceType enum
/// to handle Xtream, M3U, and Acestream sources uniformly.
#[derive(Debug, Clone)]
pub struct BackupStream {
    /// Unique identifier for this stream (xtream_channel_id, m3u_channel_id, or acestream_source_id)
    pub source_id: i32,
    /// Stream ID for logging/tracking (may be same as source_id for non-Xtream)
    pub stream_id: i32,
    /// Priority order for failover (lower = higher priority)
    pub stream_priority: i32,
    /// Available quality levels (e.g., ["4K", "HD", "SD"])
    /// For M3U/Acestream, this may be empty or contain a default
    pub qualities: Vec<String>,
    /// The source type with all required data for URL building
    pub source_type: StreamSourceType,
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
    /// Resilience configuration
    pub resilience: ResilienceConfig,
    /// Current retry count for the active stream (resets on advance)
    pub current_retry_count: u32,
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
            resilience: ResilienceConfig::default(),
            current_retry_count: 0,
        }
    }

    /// Create a new FailoverState with resilience configuration
    pub fn with_resilience(
        xmltv_channel_id: i32,
        available_streams: Vec<BackupStream>,
        resilience: ResilienceConfig,
    ) -> Self {
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
            resilience,
            current_retry_count: 0,
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

    /// Check if we should retry the current stream (transient failure)
    ///
    /// Returns true if retries are enabled, the failure is transient,
    /// and we haven't exhausted the retry count.
    pub fn should_retry(&self, reason: &FailureReason) -> bool {
        self.resilience.retries_enabled()
            && self.current_retry_count < self.resilience.max_retries
            && ResilienceConfig::is_transient_failure(reason)
    }

    /// Record a retry attempt and return the backoff delay
    pub fn record_retry(&mut self) -> Duration {
        let delay = self.resilience.backoff_delay(self.current_retry_count);
        self.current_retry_count += 1;
        delay
    }

    /// Find an alternate endpoint for the same quality level
    ///
    /// Looks for streams from different server endpoints that offer the same
    /// quality as the current stream. Skips the current stream and any already tried.
    pub fn find_alternate_endpoint(&self) -> Option<usize> {
        if !self.resilience.try_alternate_endpoints {
            return None;
        }

        let current = self.current_stream()?;
        let current_account_id = match &current.source_type {
            StreamSourceType::Xtream { account_id, .. } => Some(*account_id),
            _ => None,
        };

        // Look for streams with same quality but different endpoint
        for (idx, stream) in self.available_streams.iter().enumerate() {
            if idx == self.current_stream_idx {
                continue; // Skip current
            }
            if idx < self.current_stream_idx {
                continue; // Skip already tried
            }

            // Check if this stream has matching qualities from a different account
            let stream_account_id = match &stream.source_type {
                StreamSourceType::Xtream { account_id, .. } => Some(*account_id),
                _ => None,
            };

            // Different endpoint (different account or different source type)
            let is_different_endpoint = stream_account_id != current_account_id
                || stream_account_id.is_none();

            // Has overlapping qualities
            let has_matching_quality = current.qualities.iter().any(|q| stream.qualities.contains(q));

            if is_different_endpoint && has_matching_quality {
                return Some(idx);
            }
        }

        None
    }

    /// Move to the next backup stream
    ///
    /// Returns true if successfully moved to next stream, false if no more streams
    pub fn advance_to_next_stream(&mut self) -> bool {
        if self.has_more_backups() {
            self.current_stream_idx += 1;
            self.last_failover_at = Some(Instant::now());
            self.failover_count += 1;
            self.current_retry_count = 0; // Reset retries for new stream
            true
        } else {
            false
        }
    }

    /// Move to a specific stream index (for alternate endpoint switching)
    pub fn advance_to_stream(&mut self, idx: usize) -> bool {
        if idx < self.available_streams.len() {
            self.current_stream_idx = idx;
            self.last_failover_at = Some(Instant::now());
            self.failover_count += 1;
            self.current_retry_count = 0;
            true
        } else {
            false
        }
    }

    /// Check if we should attempt to upgrade back to primary/higher quality
    ///
    /// Returns true if:
    /// - We're on a backup stream (not primary)
    /// - Enough time has passed since last failover (uses resilience config)
    pub fn should_attempt_upgrade(&self) -> bool {
        // Only attempt upgrade if we're on a backup (not primary)
        if self.current_stream_idx == 0 {
            return false;
        }

        let recovery_period = self.resilience.recovery_period();

        match self.last_failover_at {
            Some(time) => time.elapsed() >= recovery_period,
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
#[derive(Debug, Clone, PartialEq)]
pub enum FailureReason {
    /// 5-second timeout waiting for connection
    ConnectionTimeout,
    /// Network/DNS/connection error
    ConnectionError(String),
    /// Non-2xx HTTP status code
    HttpError(u16),
    /// Error reading stream body
    StreamError(String),
    /// FIX #5 (HIGH): Credential decryption or authentication error
    /// These should not trigger retries on the same account
    CredentialError(String),
}

impl std::fmt::Display for FailureReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FailureReason::ConnectionTimeout => write!(f, "ConnectionTimeout"),
            FailureReason::ConnectionError(msg) => write!(f, "ConnectionError: {}", msg),
            FailureReason::HttpError(code) => write!(f, "HttpError: {}", code),
            FailureReason::StreamError(msg) => write!(f, "StreamError: {}", msg),
            FailureReason::CredentialError(msg) => write!(f, "CredentialError: {}", msg),
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
    ///
    /// Security: Sanitizes error messages to prevent credential exposure in logs
    pub fn from_reqwest_error(error: &reqwest::Error) -> Self {
        if error.is_timeout() {
            FailureReason::ConnectionTimeout
        } else if error.is_connect() {
            // Sanitize connection errors to avoid exposing URLs with credentials
            FailureReason::ConnectionError(Self::sanitize_error_message(&error.to_string()))
        } else if error.is_request() || error.is_redirect() {
            // Sanitize request/redirect errors to avoid exposing URLs with credentials
            FailureReason::ConnectionError(Self::sanitize_error_message(&error.to_string()))
        } else {
            // Body/decode errors are stream errors - sanitize these too
            FailureReason::StreamError(Self::sanitize_error_message(&error.to_string()))
        }
    }

    /// Sanitize error messages to remove URLs that may contain credentials
    ///
    /// Replaces URLs with a generic placeholder to prevent credential leaks in logs.
    /// Examples:
    /// - "http://user:pass@host/path" -> "[URL REDACTED]"
    /// - "Connection failed: http://api.example.com" -> "Connection failed: [URL REDACTED]"
    fn sanitize_error_message(msg: &str) -> String {
        // Simple regex to match URLs (http:// or https://)
        // This catches both bare URLs and URLs embedded in error messages
        let url_pattern = regex::Regex::new(r"https?://[^\s]+").unwrap();
        url_pattern.replace_all(msg, "[URL REDACTED]").to_string()
    }

    /// Determine failure reason from HTTP status code
    ///
    /// Called when the HTTP response status is non-2xx
    pub fn from_http_status(status: reqwest::StatusCode) -> Self {
        FailureReason::HttpError(status.as_u16())
    }

    /// Check if this failure reason indicates an account-level issue
    ///
    /// Account-level failures (e.g., HTTP 401/403, CredentialError) should skip other streams
    /// from the same account during failover.
    /// FIX #5 (HIGH): Include CredentialError in account-level failures
    pub fn is_account_level_failure(&self) -> bool {
        matches!(
            self,
            FailureReason::HttpError(401 | 403) | FailureReason::CredentialError(_)
        )
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
/// including Xtream, M3U, and Acestream sources.
///
/// Streams are ordered by:
/// 1. stream_priority ASC (lower = higher priority)
/// 2. is_primary DESC (primary streams first among equal priority)
///
/// Only includes streams from active accounts (for Xtream) and active sources.
///
/// Returns empty Vec if no mappings exist (caller handles this case).
pub fn get_all_streams_for_channel(
    conn: &mut DbPooledConnection,
    xmltv_channel_id: i32,
) -> Result<Vec<BackupStream>, FailoverError> {
    let mut all_streams = Vec::new();

    // Query 1: Xtream streams (existing behavior)
    // CR-5: xtream_channel_id is now Nullable, use nullable_eq for the join
    // FIX #4 (HIGH): Select as nullable to handle corrupted data gracefully
    let xtream_result = channel_mappings::table
        .inner_join(
            xtream_channels::table
                .on(channel_mappings::xtream_channel_id.eq(xtream_channels::id.nullable())),
        )
        .inner_join(
            accounts::table.on(xtream_channels::account_id.eq(accounts::id.assume_not_null())),
        )
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .filter(channel_mappings::source_type.eq("xtream"))
        .filter(accounts::is_active.eq(1))
        .select((
            xtream_channels::id,
            xtream_channels::stream_id,
            channel_mappings::stream_priority,
            channel_mappings::is_primary,
            xtream_channels::qualities,
            accounts::server_url,
            accounts::username,
            accounts::password_encrypted,
            accounts::id.assume_not_null(),
        ))
        .load::<(
            Option<i32>,
            i32,
            Option<i32>,
            Option<i32>,
            Option<String>,
            String,
            String,
            Vec<u8>,
            i32,
        )>(conn);

    match xtream_result {
        Ok(results) => {
            for (
                xtream_channel_id_opt,
                stream_id,
                stream_priority,
                is_primary,
                qualities_json,
                server_url,
                username,
                password_encrypted,
                account_id,
            ) in results
            {
                // FIX #4 (HIGH): Handle None case gracefully instead of panicking
                let xtream_channel_id = match xtream_channel_id_opt {
                    Some(id) => id,
                    None => {
                        eprintln!("[WARN] Skipping Xtream stream with NULL channel_id for xmltv_channel {}", xmltv_channel_id);
                        continue;
                    }
                };

                let qualities = qualities_json
                    .as_deref()
                    .map(|q| qualities_from_json(q))
                    .unwrap_or_default();

                // FIX #6 (MEDIUM): Allow quality_hint from source data (currently defaults to parsed qualities)
                // Quality parsing already handles this, but we add a note for future enhancement

                all_streams.push((
                    stream_priority.unwrap_or(0),
                    is_primary.unwrap_or(0),
                    BackupStream {
                        source_id: xtream_channel_id,
                        stream_id,
                        stream_priority: stream_priority.unwrap_or(0),
                        qualities,
                        source_type: StreamSourceType::Xtream {
                            account_id,
                            stream_id,
                            server_url,
                            username,
                            password_encrypted,
                        },
                    },
                ));
            }
        }
        Err(e) => {
            log_db_error(conn, xmltv_channel_id, &e);
            return Err(FailoverError::DatabaseError(e.to_string()));
        }
    }

    // Query 2: M3U streams
    // Note: We use nullable() on both sides since m3u_channel_id is nullable
    // CR-17: Join with m3u_sources to filter out disabled sources (is_active = 0)
    // FIX #4 (HIGH): Keep assume_not_null for the join but select as nullable
    let m3u_result = channel_mappings::table
        .inner_join(
            m3u_channels::table
                .on(channel_mappings::m3u_channel_id.eq(m3u_channels::id.nullable())),
        )
        .inner_join(
            m3u_sources::table
                .on(m3u_channels::source_id.eq(m3u_sources::id.assume_not_null())),
        )
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .filter(channel_mappings::source_type.eq("m3u"))
        .filter(channel_mappings::m3u_channel_id.is_not_null())
        .filter(m3u_sources::is_active.eq(1))
        .select((
            m3u_channels::id,
            m3u_channels::stream_url,
            channel_mappings::stream_priority,
            channel_mappings::is_primary,
        ))
        .load::<(Option<i32>, String, Option<i32>, Option<i32>)>(conn);

    match m3u_result {
        Ok(results) => {
            for (m3u_channel_id_opt, stream_url, stream_priority, is_primary) in results {
                // FIX #4: Handle None gracefully
                let m3u_channel_id = match m3u_channel_id_opt {
                    Some(id) => id,
                    None => {
                        eprintln!("[WARN] Skipping M3U stream with NULL channel_id for xmltv_channel {}", xmltv_channel_id);
                        continue;
                    }
                };
                all_streams.push((
                    stream_priority.unwrap_or(0),
                    is_primary.unwrap_or(0),
                    BackupStream {
                        source_id: m3u_channel_id,
                        stream_id: m3u_channel_id, // Use ID as stream_id for logging
                        stream_priority: stream_priority.unwrap_or(0),
                        // M3U streams are hardcoded to "SD" quality because:
                        // 1. M3U playlists typically don't contain quality metadata
                        // 2. This affects failover priority when mixing Xtream (multi-quality) with M3U sources
                        // 3. Future enhancement: Add optional quality_hint column to m3u_channels table
                        //    to allow manual quality specification per M3U stream
                        qualities: vec!["SD".to_string()],
                        source_type: StreamSourceType::M3u { stream_url },
                    },
                ));
            }
        }
        Err(e) => {
            // M3U query failure is non-fatal - we can still use Xtream streams
            eprintln!(
                "[WARN] M3U query failed for channel {}: {}",
                xmltv_channel_id, e
            );
        }
    }

    // Query 3: Acestream sources
    // Note: We use nullable() on both sides since acestream_source_id is nullable
    let acestream_result = channel_mappings::table
        .inner_join(
            acestream_sources::table
                .on(channel_mappings::acestream_source_id.eq(acestream_sources::id.nullable())),
        )
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .filter(channel_mappings::source_type.eq("acestream"))
        .filter(channel_mappings::acestream_source_id.is_not_null())
        .filter(acestream_sources::is_active.eq(1))
        .select((
            acestream_sources::id,
            acestream_sources::content_id,
            channel_mappings::stream_priority,
            channel_mappings::is_primary,
        ))
        .load::<(Option<i32>, String, Option<i32>, Option<i32>)>(conn);

    match acestream_result {
        Ok(results) => {
            for (acestream_id_opt, content_id, stream_priority, is_primary) in results {
                // FIX #4: Handle None gracefully
                let acestream_id = match acestream_id_opt {
                    Some(id) => id,
                    None => {
                        eprintln!("[WARN] Skipping Acestream source with NULL id for xmltv_channel {}", xmltv_channel_id);
                        continue;
                    }
                };
                all_streams.push((
                    stream_priority.unwrap_or(0),
                    is_primary.unwrap_or(0),
                    BackupStream {
                        source_id: acestream_id,
                        stream_id: acestream_id, // Use ID as stream_id for logging
                        stream_priority: stream_priority.unwrap_or(0),
                        // Acestream sources are hardcoded to "SD" quality because:
                        // 1. Acestream content IDs don't contain quality metadata
                        // 2. This affects failover priority when mixing Xtream (multi-quality) with Acestream sources
                        // 3. Future enhancement: Add optional quality_hint column to acestream_sources table
                        //    to allow manual quality specification per Acestream source
                        qualities: vec!["SD".to_string()],
                        source_type: StreamSourceType::Acestream { content_id },
                    },
                ));
            }
        }
        Err(e) => {
            // Acestream query failure is non-fatal
            eprintln!(
                "[WARN] Acestream query failed for channel {}: {}",
                xmltv_channel_id, e
            );
        }
    }

    // Sort by priority ASC, then is_primary DESC (1 = primary comes first)
    all_streams.sort_by(|a, b| {
        let priority_cmp = a.0.cmp(&b.0);
        if priority_cmp == std::cmp::Ordering::Equal {
            b.1.cmp(&a.1) // Descending: 1 (primary) before 0
        } else {
            priority_cmp
        }
    });

    // Extract just the BackupStream from sorted tuples
    let streams = all_streams.into_iter().map(|(_, _, s)| s).collect();

    Ok(streams)
}

/// Helper to log database errors
fn log_db_error(conn: &mut DbPooledConnection, xmltv_channel_id: i32, e: &diesel::result::Error) {
    if let Err(log_err) = crate::commands::logs::log_event_internal(
        conn,
        "error",
        "stream",
        &format!(
            "Failover database query failed for channel {}: {}",
            xmltv_channel_id, e
        ),
        Some(
            &serde_json::json!({
                "channelId": xmltv_channel_id,
                "error": e.to_string(),
            })
            .to_string()
            .as_str(),
        ),
    ) {
        eprintln!(
            "[ERROR] Failed to log failover error to database: {}",
            log_err
        );
    }
    eprintln!(
        "[ERROR] stream: Failover database query failed for channel {}: {}",
        xmltv_channel_id, e
    );
}

/// Log a failover event to the event_log table
///
/// Story 6-3: Updated to use log_event_internal for verbosity support.
/// Logs with level "warn" for successful failover, "error" for all streams exhausted.
/// Details include channel_id, from_stream_id, to_stream_id, reason, and timestamp.
pub fn log_failover_event(
    conn: &mut DbPooledConnection,
    channel_id: i32,
    from_stream_id: i32,
    to_stream_id: Option<i32>,
    reason: &FailureReason,
) -> Result<(), diesel::result::Error> {
    use crate::commands::logs::log_event_internal;

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
        "channelId": channel_id,
        "fromStreamId": from_stream_id,
        "toStreamId": to_stream_id,
        "reason": format!("{:?}", reason),
    });

    log_event_internal(
        conn,
        level_str,
        "stream",
        &message_str,
        Some(&details_json.to_string()),
    )?;

    eprintln!(
        "Failover event - {}: {} (from: {}, to: {:?}, reason: {})",
        level_str, message_str, from_stream_id, to_stream_id, reason
    );

    Ok(())
}

/// Log a quality upgrade event to the event_log table
///
/// Story 6-3: Updated to use log_event_internal for verbosity support.
pub fn log_upgrade_event(
    conn: &mut DbPooledConnection,
    channel_id: i32,
    from_stream_id: i32,
    to_stream_id: i32,
    success: bool,
) -> Result<(), diesel::result::Error> {
    use crate::commands::logs::log_event_internal;

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
        "channelId": channel_id,
        "fromStreamId": from_stream_id,
        "toStreamId": to_stream_id,
        "success": success,
    });

    log_event_internal(
        conn,
        level_str,
        "stream",
        &message_str,
        Some(&details_json.to_string()),
    )?;

    eprintln!("Upgrade event - {}: {}", level_str, message_str);

    Ok(())
}

/// Log a mid-stream failover event to the event_log table (Story 4.7)
///
/// Story 6-3: Updated to use log_event_internal for verbosity support.
/// Logs failover events that occur during an active stream session,
/// as opposed to initial connection failover.
///
/// # Arguments
/// * `conn` - Database connection
/// * `event` - Failover event details
pub fn log_mid_stream_failover_event(
    conn: &mut DbPooledConnection,
    event: &FailoverEvent,
) -> Result<(), diesel::result::Error> {
    use crate::commands::logs::log_event_internal;

    let level_str = if event.success { "warn" } else { "error" };

    let message_str = match event.to_stream_id {
        Some(to_id) => format!(
            "Mid-stream failover for channel {} (stream {} -> {}) after {:.1}s stall",
            event.xmltv_channel_id,
            event.from_stream_id,
            to_id,
            event.stall_duration.as_secs_f64()
        ),
        None => format!(
            "All streams exhausted for channel {} - session {} failed after {:.1}s stall",
            event.xmltv_channel_id,
            event.session_id,
            event.stall_duration.as_secs_f64()
        ),
    };

    let details_json = serde_json::json!({
        "failoverType": "mid_stream",
        "sessionId": event.session_id,
        "channelId": event.xmltv_channel_id,
        "fromStreamId": event.from_stream_id,
        "toStreamId": event.to_stream_id,
        "stallDurationSecs": event.stall_duration.as_secs_f64(),
        "success": event.success,
    });

    log_event_internal(
        conn,
        level_str,
        "stream",
        &message_str,
        Some(&details_json.to_string()),
    )?;

    eprintln!(
        "Mid-stream failover - {}: {} (session: {})",
        level_str, message_str, event.session_id
    );

    Ok(())
}

// ============================================================================
// Mid-Stream Failover Stream Wrapper (Story 4.7)
// ============================================================================

/// Channel capacity for the failover stream data channel
const FAILOVER_CHANNEL_CAPACITY: usize = 32;

/// A stream wrapper that supports mid-stream failover (Story 4.7)
///
/// Uses an mpsc channel to decouple the producer (BufferedStream) from the
/// consumer (HTTP response). This allows seamlessly switching to a backup
/// stream without interrupting the response to the client.
pub struct FailoverStream {
    /// Receiver for stream data chunks
    data_rx: mpsc::Receiver<Result<Bytes, io::Error>>,
    /// Handle to the producer task (for cleanup)
    producer_handle: tokio::task::JoinHandle<()>,
    /// Whether the stream has ended
    finished: bool,
}

/// Context needed to create backup streams during failover
#[derive(Clone)]
pub struct FailoverContext {
    /// Available backup streams ordered by priority
    pub available_streams: Vec<BackupStream>,
    /// Current stream index
    pub current_idx: usize,
    /// Session ID for logging
    pub session_id: String,
    /// XMLTV channel ID for event logging
    pub xmltv_channel_id: i32,
    /// Resilience configuration for mid-stream retry behavior
    pub resilience: ResilienceConfig,
}

impl FailoverContext {
    /// Create a new failover context starting at index 0
    pub fn new(
        available_streams: Vec<BackupStream>,
        session_id: String,
        xmltv_channel_id: i32,
    ) -> Self {
        Self {
            available_streams,
            current_idx: 0,
            session_id,
            xmltv_channel_id,
            resilience: ResilienceConfig::default(),
        }
    }

    /// FIX #8 (MEDIUM): Create a new failover context starting at a specific index
    /// This prevents skipping the current stream during mid-stream failover setup
    pub fn new_with_index(
        available_streams: Vec<BackupStream>,
        session_id: String,
        xmltv_channel_id: i32,
        current_idx: usize,
    ) -> Self {
        Self {
            available_streams,
            current_idx,
            session_id,
            xmltv_channel_id,
            resilience: ResilienceConfig::default(),
        }
    }

    /// Create a failover context with resilience configuration
    pub fn with_resilience(
        available_streams: Vec<BackupStream>,
        session_id: String,
        xmltv_channel_id: i32,
        current_idx: usize,
        resilience: ResilienceConfig,
    ) -> Self {
        Self {
            available_streams,
            current_idx,
            session_id,
            xmltv_channel_id,
            resilience,
        }
    }

    /// Get the current stream
    pub fn current_stream(&self) -> Option<&BackupStream> {
        self.available_streams.get(self.current_idx)
    }

    /// Get the next backup stream (if available)
    pub fn next_stream(&self) -> Option<&BackupStream> {
        self.available_streams.get(self.current_idx + 1)
    }

    /// Move to the next stream
    pub fn advance(&mut self) -> bool {
        if self.current_idx + 1 < self.available_streams.len() {
            self.current_idx += 1;
            true
        } else {
            false
        }
    }

    /// Check if there are more backup streams
    pub fn has_more_backups(&self) -> bool {
        self.current_idx + 1 < self.available_streams.len()
    }
}

impl FailoverStream {
    /// Create a new FailoverStream wrapping a data receiver
    ///
    /// This is used internally by the producer task.
    pub(crate) fn new(
        data_rx: mpsc::Receiver<Result<Bytes, io::Error>>,
        producer_handle: tokio::task::JoinHandle<()>,
    ) -> Self {
        Self {
            data_rx,
            producer_handle,
            finished: false,
        }
    }
}

impl Stream for FailoverStream {
    type Item = Result<Bytes, io::Error>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        if self.finished {
            return Poll::Ready(None);
        }

        match Pin::new(&mut self.data_rx).poll_recv(cx) {
            Poll::Ready(Some(result)) => Poll::Ready(Some(result)),
            Poll::Ready(None) => {
                self.finished = true;
                Poll::Ready(None)
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

impl Drop for FailoverStream {
    fn drop(&mut self) {
        // Abort the producer task when the stream is dropped
        self.producer_handle.abort();
    }
}

/// Failover event information for logging
#[derive(Debug, Clone)]
pub struct FailoverEvent {
    /// Session ID
    pub session_id: String,
    /// XMLTV channel ID
    pub xmltv_channel_id: i32,
    /// Previous stream ID
    pub from_stream_id: i32,
    /// New stream ID (None if all streams exhausted)
    pub to_stream_id: Option<i32>,
    /// Duration of the stall before failover
    pub stall_duration: Duration,
    /// Whether failover was successful
    pub success: bool,
}

/// Callback type for failover events
pub type FailoverCallback = Arc<dyn Fn(FailoverEvent) + Send + Sync>;

/// Create a FailoverStream with mid-stream failover capability (Story 4.7)
///
/// This function creates a stream that:
/// 1. Reads from the initial BufferedStream
/// 2. Monitors for failover signals
/// 3. When failover is triggered, creates a new BufferedStream with backup URL
/// 4. Continues seamlessly from the new stream
///
/// # Arguments
/// * `initial_stream` - The initial BufferedStream to read from
/// * `context` - Failover context with backup streams
/// * `stream_manager` - Stream manager for session tracking
/// * `credential_manager` - For decrypting passwords
/// * `on_failover` - Optional callback for failover events
///
/// # Returns
/// A FailoverStream that handles mid-stream failover transparently
pub fn create_failover_stream(
    initial_stream: super::buffer::BufferedStream,
    context: FailoverContext,
    stream_manager: Arc<super::stream::StreamManager>,
    credential_manager: crate::credentials::CredentialManager,
    on_failover: Option<FailoverCallback>,
) -> FailoverStream {
    use super::buffer::{BufferedStream, BufferConfig};
    use super::stream::build_stream_url_for_source;

    let (data_tx, data_rx) = mpsc::channel(FAILOVER_CHANNEL_CAPACITY);

    let producer_handle = tokio::spawn(async move {
        let mut current_stream = initial_stream;
        let mut ctx = context;
        let mut failover_rx = current_stream.failover_receiver();
        let mut stall_start: Option<Instant> = None; // Track when stall started (H2 fix)

        loop {
            tokio::select! {
                // Read data from current stream
                chunk = futures_util::StreamExt::next(&mut current_stream) => {
                    match chunk {
                        Some(Ok(data)) => {
                            stall_start = None; // Reset stall tracking on successful data (H2 fix)
                            if data_tx.send(Ok(data)).await.is_err() {
                                // Consumer dropped, exit
                                break;
                            }
                        }
                        Some(Err(e)) => {
                            // Stream error - try failover
                            eprintln!("[ERROR] stream:{} read error: {}", ctx.session_id, e);
                            if !ctx.has_more_backups() {
                                let _ = data_tx.send(Err(e)).await;
                                break;
                            }
                            // Fall through to failover
                        }
                        None => {
                            // Stream ended normally
                            break;
                        }
                    }
                }
                // Monitor failover signal
                result = failover_rx.changed() => {
                    if result.is_err() {
                        // Sender dropped, continue reading
                        continue;
                    }
                    if !*failover_rx.borrow() {
                        // Signal was false, continue
                        continue;
                    }

                    // Track when stall started for accurate duration (H2 fix)
                    let stall_duration = match stall_start {
                        Some(start) => start.elapsed(),
                        None => {
                            // First failover signal - start tracking now
                            stall_start = Some(Instant::now());
                            Duration::from_secs(5) // Approximate for first signal
                        }
                    };

                    // Failover triggered
                    eprintln!("[INFO] stream:{} failover signal received (stall: {:.1}s, strictness: {})",
                        ctx.session_id, stall_duration.as_secs_f64(), ctx.resilience.strictness);

                    // Retry current stream with backoff if resilience allows it
                    let mut retried_successfully = false;
                    if ctx.resilience.retries_enabled() {
                        let max_retries = ctx.resilience.max_retries;
                        for retry in 0..max_retries {
                            let delay = ctx.resilience.backoff_delay(retry);
                            eprintln!(
                                "[INFO] stream:{} retry {}/{} after {}ms backoff",
                                ctx.session_id, retry + 1, max_retries, delay.as_millis()
                            );
                            tokio::time::sleep(delay).await;

                            // Try to reconnect to current stream
                            let current = match ctx.current_stream() {
                                Some(s) => s.clone(),
                                None => break,
                            };

                            let retry_url = match build_stream_url_for_source(
                                &current.source_type,
                                Some(&credential_manager),
                            ) {
                                Ok(url) => url,
                                Err(_) => continue,
                            };

                            match BufferedStream::new(
                                &retry_url,
                                BufferConfig::default(),
                                ctx.session_id.clone(),
                                stream_manager.clone(),
                            ) {
                                Ok(new) => {
                                    eprintln!(
                                        "[INFO] stream:{} retry {}/{} successful - resuming",
                                        ctx.session_id, retry + 1, max_retries
                                    );
                                    stall_start = None;
                                    drop(current_stream);
                                    current_stream = new;
                                    failover_rx = current_stream.failover_receiver();
                                    retried_successfully = true;
                                    break;
                                }
                                Err(e) => {
                                    eprintln!(
                                        "[WARN] stream:{} retry {}/{} failed: {}",
                                        ctx.session_id, retry + 1, max_retries, e
                                    );
                                }
                            }
                        }
                    }

                    if retried_successfully {
                        continue; // Back to main loop with reconnected stream
                    }

                    // Get backup stream info
                    if !ctx.has_more_backups() {
                        // All streams exhausted - handle gracefully (Story 4.7 Task 7)
                        let from_stream_id = ctx.current_stream()
                            .map(|s| s.stream_id)
                            .unwrap_or(0);

                        eprintln!(
                            "[WARN] stream:{} ALL STREAMS EXHAUSTED - channel:{}, tried:{} streams",
                            ctx.session_id, ctx.xmltv_channel_id, ctx.available_streams.len()
                        );

                        // Log exhaustion event via callback (H2 fix: use actual stall_duration)
                        if let Some(ref callback) = on_failover {
                            callback(FailoverEvent {
                                session_id: ctx.session_id.clone(),
                                xmltv_channel_id: ctx.xmltv_channel_id,
                                from_stream_id,
                                to_stream_id: None, // No backup available
                                stall_duration, // H2 fix: actual duration, not hardcoded
                                success: false, // Exhaustion is a failure
                            });
                        }

                        // H1 fix: Update session health status to Failed
                        stream_manager.update_session(&ctx.session_id, |session| {
                            session.update_health(super::buffer::StreamHealth::Failed);
                        });

                        // FIX #10 (MEDIUM): Graceful drain with 5-second timeout
                        // Read remaining buffered data but don't hang indefinitely
                        eprintln!(
                            "[INFO] stream:{} draining remaining buffer before termination",
                            ctx.session_id
                        );

                        let drain_timeout = Duration::from_secs(5);
                        let drain_result = tokio::time::timeout(drain_timeout, async {
                            // Read remaining data without checking failover (it would just loop)
                            loop {
                                match futures_util::StreamExt::next(&mut current_stream).await {
                                    Some(Ok(data)) => {
                                        if data_tx.send(Ok(data)).await.is_err() {
                                            break; // Consumer dropped
                                        }
                                    }
                                    Some(Err(_)) | None => break, // Stream ended
                                }
                            }
                        }).await;

                        match drain_result {
                            Ok(_) => eprintln!(
                                "[INFO] stream:{} graceful termination complete",
                                ctx.session_id
                            ),
                            Err(_) => eprintln!(
                                "[WARN] stream:{} drain timeout after {}s, terminating",
                                ctx.session_id,
                                drain_timeout.as_secs()
                            ),
                        }
                        break;
                    }

                    let from_stream_id = ctx.current_stream()
                        .map(|s| s.stream_id)
                        .unwrap_or(0);

                    ctx.advance();

                    let backup = match ctx.current_stream() {
                        Some(s) => s.clone(),
                        None => {
                            eprintln!("[ERROR] stream:{} failed to get backup stream", ctx.session_id);
                            break;
                        }
                    };

                    // Build backup stream URL using source type
                    let backup_url = match build_stream_url_for_source(
                        &backup.source_type,
                        Some(&credential_manager),
                    ) {
                        Ok(url) => url,
                        Err(e) => {
                            eprintln!("[ERROR] stream:{} URL build error: {}", ctx.session_id, e);
                            // Try next backup if available
                            continue;
                        }
                    };

                    eprintln!(
                        "[INFO] stream:{} switching to backup stream {} (priority {})",
                        ctx.session_id, backup.stream_id, backup.stream_priority
                    );

                    // Create new BufferedStream with backup URL
                    let new_stream = match BufferedStream::new(
                        &backup_url,
                        BufferConfig::default(),
                        ctx.session_id.clone(),
                        stream_manager.clone(),
                    ) {
                        Ok(s) => s,
                        Err(e) => {
                            eprintln!("[ERROR] stream:{} failed to create backup stream: {}", ctx.session_id, e);
                            // Try next backup if available
                            continue;
                        }
                    };

                    // Log failover event (H2 fix: use actual stall_duration)
                    if let Some(ref callback) = on_failover {
                        callback(FailoverEvent {
                            session_id: ctx.session_id.clone(),
                            xmltv_channel_id: ctx.xmltv_channel_id,
                            from_stream_id,
                            to_stream_id: Some(backup.stream_id),
                            stall_duration, // H2 fix: actual duration, not hardcoded
                            success: true,
                        });
                    }

                    // H1 fix: Update session to record the failover
                    let backup_quality = backup.qualities.first()
                        .cloned()
                        .unwrap_or_else(|| "SD".to_string());
                    stream_manager.update_session(&ctx.session_id, |session| {
                        session.record_failover(backup.stream_id, backup_quality.clone());
                    });

                    eprintln!(
                        "[INFO] stream:{} failover complete: {} -> {} (quality: {})",
                        ctx.session_id, from_stream_id, backup.stream_id, backup_quality
                    );

                    // Reset stall tracking after successful failover
                    stall_start = None;

                    // Drop old stream and switch to new one
                    drop(current_stream);
                    current_stream = new_stream;
                    failover_rx = current_stream.failover_receiver();
                }
            }
        }
    });

    FailoverStream::new(data_rx, producer_handle)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to create test BackupStream (Xtream type for backwards compatibility)
    fn create_test_stream(stream_id: i32, priority: i32) -> BackupStream {
        BackupStream {
            source_id: stream_id,
            stream_id,
            stream_priority: priority,
            qualities: vec!["HD".to_string(), "SD".to_string()],
            source_type: StreamSourceType::Xtream {
                account_id: 1,
                stream_id,
                server_url: format!("http://test-{}.local:8080", stream_id),
                username: "testuser".to_string(),
                password_encrypted: vec![],
            },
        }
    }

    // Helper to create test M3U BackupStream
    fn create_test_m3u_stream(stream_id: i32, priority: i32, url: &str) -> BackupStream {
        BackupStream {
            source_id: stream_id,
            stream_id,
            stream_priority: priority,
            qualities: vec!["SD".to_string()],
            source_type: StreamSourceType::M3u {
                stream_url: url.to_string(),
            },
        }
    }

    // Helper to create test Acestream BackupStream
    fn create_test_acestream(stream_id: i32, priority: i32, content_id: &str) -> BackupStream {
        BackupStream {
            source_id: stream_id,
            stream_id,
            stream_priority: priority,
            qualities: vec!["SD".to_string()],
            source_type: StreamSourceType::Acestream {
                content_id: content_id.to_string(),
            },
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

    // =========================================================================
    // FailoverContext Tests (Story 4.7)
    // =========================================================================

    #[test]
    fn test_failover_context_creation() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
            create_test_stream(102, 2),
        ];
        let ctx = FailoverContext::new(streams, "test-session".to_string(), 1);

        assert_eq!(ctx.current_idx, 0);
        assert_eq!(ctx.session_id, "test-session");
        assert_eq!(ctx.xmltv_channel_id, 1);
        assert!(ctx.current_stream().is_some());
        assert_eq!(ctx.current_stream().unwrap().stream_id, 100);
    }

    #[test]
    fn test_failover_context_advance() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
            create_test_stream(102, 2),
        ];
        let mut ctx = FailoverContext::new(streams, "test-session".to_string(), 1);

        // Initial state
        assert!(ctx.has_more_backups());
        assert_eq!(ctx.current_stream().unwrap().stream_id, 100);

        // Advance to first backup
        assert!(ctx.advance());
        assert_eq!(ctx.current_stream().unwrap().stream_id, 101);
        assert!(ctx.has_more_backups());

        // Advance to second backup
        assert!(ctx.advance());
        assert_eq!(ctx.current_stream().unwrap().stream_id, 102);
        assert!(!ctx.has_more_backups());

        // Cannot advance further
        assert!(!ctx.advance());
        assert_eq!(ctx.current_idx, 2);
    }

    #[test]
    fn test_failover_context_next_stream() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let ctx = FailoverContext::new(streams, "test-session".to_string(), 1);

        assert!(ctx.next_stream().is_some());
        assert_eq!(ctx.next_stream().unwrap().stream_id, 101);
    }

    #[test]
    fn test_failover_context_no_next_stream() {
        let streams = vec![create_test_stream(100, 0)];
        let ctx = FailoverContext::new(streams, "test-session".to_string(), 1);

        assert!(ctx.next_stream().is_none());
        assert!(!ctx.has_more_backups());
    }

    // =========================================================================
    // FailoverEvent Tests (Story 4.7)
    // =========================================================================

    #[test]
    fn test_failover_event_creation() {
        let event = FailoverEvent {
            session_id: "test-session".to_string(),
            xmltv_channel_id: 1,
            from_stream_id: 100,
            to_stream_id: Some(101),
            stall_duration: Duration::from_secs(5),
            success: true,
        };

        assert_eq!(event.session_id, "test-session");
        assert_eq!(event.xmltv_channel_id, 1);
        assert_eq!(event.from_stream_id, 100);
        assert_eq!(event.to_stream_id, Some(101));
        assert!(event.success);
    }

    #[test]
    fn test_failover_event_exhaustion() {
        let event = FailoverEvent {
            session_id: "test-session".to_string(),
            xmltv_channel_id: 1,
            from_stream_id: 102,
            to_stream_id: None, // All streams exhausted
            stall_duration: Duration::from_secs(5),
            success: false,
        };

        assert!(event.to_stream_id.is_none());
        assert!(!event.success);
    }

    // =========================================================================
    // Multi-Source BackupStream Tests
    // =========================================================================

    #[test]
    fn test_backup_stream_xtream_source_type() {
        let stream = create_test_stream(100, 0);
        match &stream.source_type {
            StreamSourceType::Xtream { stream_id, .. } => {
                assert_eq!(*stream_id, 100);
            }
            _ => panic!("Expected Xtream source type"),
        }
    }

    #[test]
    fn test_backup_stream_m3u_source_type() {
        let stream = create_test_m3u_stream(200, 1, "http://m3u.example.com/live.m3u8");
        assert_eq!(stream.source_id, 200);
        assert_eq!(stream.stream_priority, 1);
        match &stream.source_type {
            StreamSourceType::M3u { stream_url } => {
                assert_eq!(stream_url, "http://m3u.example.com/live.m3u8");
            }
            _ => panic!("Expected M3u source type"),
        }
    }

    #[test]
    fn test_backup_stream_acestream_source_type() {
        let stream = create_test_acestream(300, 2, "abc123def456");
        assert_eq!(stream.source_id, 300);
        assert_eq!(stream.stream_priority, 2);
        match &stream.source_type {
            StreamSourceType::Acestream { content_id } => {
                assert_eq!(content_id, "abc123def456");
            }
            _ => panic!("Expected Acestream source type"),
        }
    }

    #[test]
    fn test_multi_source_failover_state() {
        // Mixed source types: Xtream primary, M3U backup, Acestream tertiary
        let streams = vec![
            create_test_stream(100, 0),                                    // Xtream primary
            create_test_m3u_stream(200, 1, "http://backup.m3u8"),          // M3U backup
            create_test_acestream(300, 2, "abc123"),                       // Acestream tertiary
        ];
        let mut state = FailoverState::new(1, streams);

        // Start on Xtream
        assert_eq!(state.current_stream().unwrap().stream_id, 100);
        assert!(matches!(
            state.current_stream().unwrap().source_type,
            StreamSourceType::Xtream { .. }
        ));

        // Failover to M3U
        assert!(state.advance_to_next_stream());
        assert_eq!(state.current_stream().unwrap().stream_id, 200);
        assert!(matches!(
            state.current_stream().unwrap().source_type,
            StreamSourceType::M3u { .. }
        ));

        // Failover to Acestream
        assert!(state.advance_to_next_stream());
        assert_eq!(state.current_stream().unwrap().stream_id, 300);
        assert!(matches!(
            state.current_stream().unwrap().source_type,
            StreamSourceType::Acestream { .. }
        ));

        // No more backups
        assert!(!state.has_more_backups());
    }

    #[test]
    fn test_multi_source_failover_context() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_m3u_stream(200, 1, "http://backup.m3u8"),
        ];
        let mut ctx = FailoverContext::new(streams, "multi-test".to_string(), 1);

        // Verify initial state
        assert!(matches!(
            ctx.current_stream().unwrap().source_type,
            StreamSourceType::Xtream { .. }
        ));
        assert!(matches!(
            ctx.next_stream().unwrap().source_type,
            StreamSourceType::M3u { .. }
        ));

        // Advance and verify
        ctx.advance();
        assert!(matches!(
            ctx.current_stream().unwrap().source_type,
            StreamSourceType::M3u { .. }
        ));
    }

    // =========================================================================
    // Resilience Config Tests (ip-6fj)
    // =========================================================================

    #[test]
    fn test_strictness_from_str() {
        assert_eq!("strict".parse::<FailoverStrictness>().unwrap(), FailoverStrictness::Strict);
        assert_eq!("balanced".parse::<FailoverStrictness>().unwrap(), FailoverStrictness::Balanced);
        assert_eq!("lenient".parse::<FailoverStrictness>().unwrap(), FailoverStrictness::Lenient);
        assert_eq!("BALANCED".parse::<FailoverStrictness>().unwrap(), FailoverStrictness::Balanced);
        assert!("unknown".parse::<FailoverStrictness>().is_err());
    }

    #[test]
    fn test_strictness_display() {
        assert_eq!(FailoverStrictness::Strict.to_string(), "strict");
        assert_eq!(FailoverStrictness::Balanced.to_string(), "balanced");
        assert_eq!(FailoverStrictness::Lenient.to_string(), "lenient");
    }

    #[test]
    fn test_resilience_config_strict_preset() {
        let config = ResilienceConfig::from_strictness(FailoverStrictness::Strict);
        assert_eq!(config.max_retries, 0);
        assert_eq!(config.backoff_base_ms, 0);
        assert!(!config.retries_enabled());
        assert!(!config.recovery_enabled());
        assert!(!config.try_alternate_endpoints);
    }

    #[test]
    fn test_resilience_config_balanced_preset() {
        let config = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        assert_eq!(config.max_retries, 2);
        assert_eq!(config.backoff_base_ms, 1000);
        assert!(config.retries_enabled());
        assert!(config.recovery_enabled());
        assert!(config.try_alternate_endpoints);
    }

    #[test]
    fn test_resilience_config_lenient_preset() {
        let config = ResilienceConfig::from_strictness(FailoverStrictness::Lenient);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.backoff_base_ms, 2000);
        assert_eq!(config.recovery_check_secs, 30);
        assert!(config.try_alternate_endpoints);
    }

    #[test]
    fn test_backoff_delay_exponential() {
        let config = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        // base=1000, multiplier=2.0
        assert_eq!(config.backoff_delay(0), Duration::from_millis(1000)); // 1000 * 2^0
        assert_eq!(config.backoff_delay(1), Duration::from_millis(2000)); // 1000 * 2^1
        assert_eq!(config.backoff_delay(2), Duration::from_millis(4000)); // 1000 * 2^2 (capped)
    }

    #[test]
    fn test_backoff_delay_caps_at_max() {
        let config = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        // backoff_max_ms = 4000 for balanced
        assert_eq!(config.backoff_delay(5), Duration::from_millis(4000)); // Would be 32000, capped to 4000
    }

    #[test]
    fn test_backoff_delay_zero_for_strict() {
        let config = ResilienceConfig::from_strictness(FailoverStrictness::Strict);
        assert_eq!(config.backoff_delay(0), Duration::ZERO);
        assert_eq!(config.backoff_delay(5), Duration::ZERO);
    }

    #[test]
    fn test_is_transient_failure() {
        assert!(ResilienceConfig::is_transient_failure(&FailureReason::ConnectionTimeout));
        assert!(ResilienceConfig::is_transient_failure(&FailureReason::ConnectionError("dns".into())));
        assert!(ResilienceConfig::is_transient_failure(&FailureReason::StreamError("read".into())));
        // HTTP errors and credential errors are NOT transient
        assert!(!ResilienceConfig::is_transient_failure(&FailureReason::HttpError(404)));
        assert!(!ResilienceConfig::is_transient_failure(&FailureReason::CredentialError("bad".into())));
    }

    #[test]
    fn test_should_retry_with_balanced_config() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let resilience = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        let state = FailoverState::with_resilience(1, streams, resilience);

        // Transient errors should be retried
        assert!(state.should_retry(&FailureReason::ConnectionTimeout));
        // HTTP errors should not be retried
        assert!(!state.should_retry(&FailureReason::HttpError(404)));
    }

    #[test]
    fn test_should_not_retry_with_strict_config() {
        let streams = vec![create_test_stream(100, 0)];
        let resilience = ResilienceConfig::from_strictness(FailoverStrictness::Strict);
        let state = FailoverState::with_resilience(1, streams, resilience);

        // Strict mode never retries
        assert!(!state.should_retry(&FailureReason::ConnectionTimeout));
    }

    #[test]
    fn test_retry_exhaustion() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];
        let resilience = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        let mut state = FailoverState::with_resilience(1, streams, resilience);

        // Should allow 2 retries for balanced
        assert!(state.should_retry(&FailureReason::ConnectionTimeout));
        state.record_retry();
        assert!(state.should_retry(&FailureReason::ConnectionTimeout));
        state.record_retry();
        // Now exhausted
        assert!(!state.should_retry(&FailureReason::ConnectionTimeout));
    }

    #[test]
    fn test_retry_count_resets_on_advance() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
            create_test_stream(102, 2),
        ];
        let resilience = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        let mut state = FailoverState::with_resilience(1, streams, resilience);

        state.record_retry();
        state.record_retry();
        assert_eq!(state.current_retry_count, 2);

        // Advance resets retry count
        state.advance_to_next_stream();
        assert_eq!(state.current_retry_count, 0);
        assert!(state.should_retry(&FailureReason::ConnectionTimeout));
    }

    #[test]
    fn test_find_alternate_endpoint_different_account() {
        let streams = vec![
            BackupStream {
                source_id: 100,
                stream_id: 100,
                stream_priority: 0,
                qualities: vec!["HD".to_string()],
                source_type: StreamSourceType::Xtream {
                    account_id: 1,
                    stream_id: 100,
                    server_url: "http://server1.local".to_string(),
                    username: "user1".to_string(),
                    password_encrypted: vec![],
                },
            },
            BackupStream {
                source_id: 200,
                stream_id: 200,
                stream_priority: 1,
                qualities: vec!["HD".to_string()],
                source_type: StreamSourceType::Xtream {
                    account_id: 2,
                    stream_id: 200,
                    server_url: "http://server2.local".to_string(),
                    username: "user2".to_string(),
                    password_encrypted: vec![],
                },
            },
            BackupStream {
                source_id: 300,
                stream_id: 300,
                stream_priority: 2,
                qualities: vec!["SD".to_string()],
                source_type: StreamSourceType::Xtream {
                    account_id: 3,
                    stream_id: 300,
                    server_url: "http://server3.local".to_string(),
                    username: "user3".to_string(),
                    password_encrypted: vec![],
                },
            },
        ];
        let resilience = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        let state = FailoverState::with_resilience(1, streams, resilience);

        // Should find stream 200 as alternate (same HD quality, different account)
        let alt = state.find_alternate_endpoint();
        assert_eq!(alt, Some(1));
    }

    #[test]
    fn test_find_alternate_endpoint_no_match() {
        let streams = vec![
            BackupStream {
                source_id: 100,
                stream_id: 100,
                stream_priority: 0,
                qualities: vec!["4K".to_string()],
                source_type: StreamSourceType::Xtream {
                    account_id: 1,
                    stream_id: 100,
                    server_url: "http://server1.local".to_string(),
                    username: "user1".to_string(),
                    password_encrypted: vec![],
                },
            },
            BackupStream {
                source_id: 200,
                stream_id: 200,
                stream_priority: 1,
                qualities: vec!["SD".to_string()],
                source_type: StreamSourceType::Xtream {
                    account_id: 1, // Same account
                    stream_id: 200,
                    server_url: "http://server1.local".to_string(),
                    username: "user1".to_string(),
                    password_encrypted: vec![],
                },
            },
        ];
        let resilience = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        let state = FailoverState::with_resilience(1, streams, resilience);

        // No alternate: same account, different quality
        assert_eq!(state.find_alternate_endpoint(), None);
    }

    #[test]
    fn test_advance_to_stream() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
            create_test_stream(102, 2),
        ];
        let mut state = FailoverState::new(1, streams);

        assert!(state.advance_to_stream(2));
        assert_eq!(state.current_stream().unwrap().stream_id, 102);
        assert_eq!(state.failover_count, 1);
        assert_eq!(state.current_retry_count, 0);

        // Out of bounds
        assert!(!state.advance_to_stream(5));
    }

    #[test]
    fn test_recovery_period_from_resilience() {
        let streams = vec![
            create_test_stream(100, 0),
            create_test_stream(101, 1),
        ];

        // Balanced: 60s recovery
        let balanced = ResilienceConfig::from_strictness(FailoverStrictness::Balanced);
        let state = FailoverState::with_resilience(1, streams.clone(), balanced);
        assert_eq!(state.resilience.recovery_period(), Duration::from_secs(60));

        // Lenient: 30s recovery
        let lenient = ResilienceConfig::from_strictness(FailoverStrictness::Lenient);
        let state = FailoverState::with_resilience(1, streams, lenient);
        assert_eq!(state.resilience.recovery_period(), Duration::from_secs(30));
    }
}
