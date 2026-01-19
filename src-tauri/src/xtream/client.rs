//! Xtream Codes API client implementation
//!
//! Handles HTTP communication with Xtream Codes servers for authentication
//! and account status retrieval.

use reqwest::Client;
use std::time::Duration;

use super::types::{AccountInfo, XtreamAuthResponse};
use super::XtreamError;

/// HTTP timeout for Xtream API requests (10 seconds)
const REQUEST_TIMEOUT_SECS: u64 = 10;

/// Client for communicating with Xtream Codes API
#[derive(Debug)]
pub struct XtreamClient {
    http: Client,
    server_url: String,
    username: String,
    password: String,
}

impl XtreamClient {
    /// Create a new Xtream client
    ///
    /// # Arguments
    /// * `server_url` - Base URL of the Xtream server (e.g., "http://example.com:8080")
    /// * `username` - Account username
    /// * `password` - Account password (not logged)
    ///
    /// # Returns
    /// * `Ok(XtreamClient)` - Successfully created client
    /// * `Err(XtreamError)` - Failed to create HTTP client or invalid URL
    pub fn new(server_url: &str, username: &str, password: &str) -> Result<Self, XtreamError> {
        // Validate server URL is not empty
        let trimmed_url = server_url.trim().trim_end_matches('/');
        if trimmed_url.is_empty() {
            return Err(XtreamError::InvalidUrl);
        }

        // Create HTTP client
        let http = Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| XtreamError::Network(e))?;

        Ok(Self {
            http,
            server_url: trimmed_url.to_string(),
            username: username.to_string(),
            password: password.to_string(),
        })
    }

    /// Authenticate with the Xtream server
    ///
    /// Makes a GET request to `player_api.php` endpoint with credentials
    /// and parses the response to extract account information.
    ///
    /// # Returns
    /// * `Ok(AccountInfo)` - Successfully authenticated with account details
    /// * `Err(XtreamError)` - Authentication failed or network error
    pub async fn authenticate(&self) -> Result<AccountInfo, XtreamError> {
        // SECURITY NOTE: Xtream Codes protocol requires credentials in query parameters.
        // This means passwords may appear in server logs, proxy logs, and browser history.
        // This is a limitation of the Xtream Codes API specification, not our implementation.
        // Always use HTTPS connections when possible to minimize exposure.
        let url = format!(
            "{}/player_api.php?username={}&password={}",
            self.server_url,
            urlencoding::encode(&self.username),
            urlencoding::encode(&self.password)
        );

        // Make HTTP request
        let response = self.http.get(&url).send().await?;

        // Check HTTP status
        if !response.status().is_success() {
            return Err(XtreamError::HttpError(response.status().as_u16()));
        }

        // Parse JSON response
        let auth_response: XtreamAuthResponse = response.json().await.map_err(|e| {
            if e.is_decode() {
                XtreamError::InvalidResponse
            } else {
                XtreamError::Network(e)
            }
        })?;

        // Check authentication status
        if auth_response.user_info.auth != 1 {
            return Err(XtreamError::AuthenticationFailed);
        }

        Ok(AccountInfo::from(auth_response))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = XtreamClient::new("http://example.com:8080", "user", "pass").unwrap();
        assert_eq!(client.server_url, "http://example.com:8080");
        assert_eq!(client.username, "user");
        assert_eq!(client.password, "pass");
    }

    #[test]
    fn test_client_strips_trailing_slash() {
        let client = XtreamClient::new("http://example.com:8080/", "user", "pass").unwrap();
        assert_eq!(client.server_url, "http://example.com:8080");
    }

    #[test]
    fn test_client_handles_multiple_trailing_slashes() {
        let client = XtreamClient::new("http://example.com:8080///", "user", "pass").unwrap();
        // trim_end_matches removes all trailing slashes
        assert_eq!(client.server_url, "http://example.com:8080");
    }

    #[test]
    fn test_client_rejects_empty_url() {
        let result = XtreamClient::new("", "user", "pass");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), XtreamError::InvalidUrl));
    }

    #[test]
    fn test_client_rejects_whitespace_only_url() {
        let result = XtreamClient::new("   ", "user", "pass");
        assert!(result.is_err());
    }
}
