//! Xtream Codes API client module
//!
//! Provides functionality to connect to and authenticate with Xtream Codes IPTV providers.
//! This module implements FR2 (API authentication) and FR7 (connection testing) from the PRD.

pub mod client;
pub mod types;

use thiserror::Error;

pub use client::XtreamClient;
pub use types::{AccountInfo, XtreamAuthResponse, UserInfo, ServerInfo};

/// Errors that can occur during Xtream API operations
#[derive(Debug, Error)]
pub enum XtreamError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("HTTP error: status {0}")]
    HttpError(u16),

    #[error("Authentication failed - check username and password")]
    AuthenticationFailed,

    #[error("Invalid server response")]
    InvalidResponse,

    #[error("Invalid server URL")]
    InvalidUrl,
}

impl XtreamError {
    /// Get a user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            Self::Network(e) => {
                if e.is_timeout() {
                    "Connection timed out. Server may be offline or unreachable".into()
                } else {
                    "Cannot connect to server. Check your internet connection".into()
                }
            }
            Self::HttpError(code) => format!("Server returned error (HTTP {})", code),
            Self::AuthenticationFailed => "Invalid username or password".into(),
            Self::InvalidResponse => "Server returned unexpected data format".into(),
            Self::InvalidUrl => "Invalid server URL format".into(),
        }
    }

    /// Get actionable suggestions for the user
    pub fn suggestions(&self) -> Vec<String> {
        match self {
            Self::Network(e) if e.is_timeout() => vec![
                "Check your internet connection".into(),
                "Verify the server URL is correct".into(),
                "The server may be temporarily down or too slow".into(),
            ],
            Self::Network(_) => vec![
                "Check your internet connection".into(),
                "Verify the server URL is correct".into(),
                "The server may be unreachable".into(),
            ],
            Self::AuthenticationFailed => vec![
                "Double-check your username and password".into(),
                "Ensure your subscription is active".into(),
                "Contact your provider if issues persist".into(),
            ],
            Self::HttpError(code) if *code >= 500 => vec![
                "Server is experiencing issues".into(),
                "Try again later".into(),
            ],
            Self::HttpError(_) => vec![
                "Check the server URL is correct".into(),
                "Ensure you're using the right port".into(),
            ],
            Self::InvalidResponse => vec![
                "The server may not be an Xtream Codes server".into(),
                "Verify the server URL".into(),
            ],
            Self::InvalidUrl => vec![
                "Server URL should start with http:// or https://".into(),
                "Include the port number if required".into(),
            ],
        }
    }
}
