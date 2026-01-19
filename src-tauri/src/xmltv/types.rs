//! XMLTV data types and error handling

use thiserror::Error;

/// Errors that can occur during XMLTV operations
#[derive(Debug, Error)]
pub enum XmltvError {
    #[error("Failed to download XMLTV: {0}")]
    DownloadError(String),

    #[error("Failed to decompress XMLTV: {0}")]
    DecompressError(String),

    #[error("Failed to parse XMLTV: {0}")]
    ParseError(String),

    #[error("Invalid timestamp format: {0}")]
    TimestampError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),

    #[error("URL not allowed: {0}")]
    UrlNotAllowed(String),
}

impl XmltvError {
    /// Get a user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            Self::DownloadError(_) => {
                "Failed to download EPG data. Check the URL and try again.".into()
            }
            Self::DecompressError(_) => {
                "Failed to decompress EPG file. The file may be corrupted.".into()
            }
            Self::ParseError(_) => {
                "Failed to parse EPG data. The file format may be invalid.".into()
            }
            Self::TimestampError(_) => "EPG data contains invalid timestamps.".into(),
            Self::DatabaseError(_) => "Failed to save EPG data to database.".into(),
            Self::UrlNotAllowed(_) => "The provided URL is not allowed for security reasons.".into(),
        }
    }
}

/// A parsed channel from XMLTV data
#[derive(Debug, Clone)]
pub struct ParsedChannel {
    /// Channel ID (from XMLTV `id` attribute)
    pub channel_id: String,
    /// Display name (first display-name element)
    pub display_name: String,
    /// Icon URL (from icon element src attribute)
    pub icon: Option<String>,
}

/// A parsed program from XMLTV data
#[derive(Debug, Clone)]
pub struct ParsedProgram {
    /// Channel ID this program belongs to
    pub channel_id: String,
    /// Program title
    pub title: String,
    /// Program description
    pub description: Option<String>,
    /// Start time in ISO 8601 format (UTC)
    pub start_time: String,
    /// End time in ISO 8601 format (UTC)
    pub end_time: String,
    /// Program category
    pub category: Option<String>,
    /// Episode info (raw XMLTV format)
    pub episode_info: Option<String>,
}
