//! Xtream Codes API response types
//!
//! Defines the data structures for parsing Xtream Codes API responses.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt::Display;
use std::str::FromStr;
use tracing::warn;

/// Deserialize a number that may come as a string or int
fn deserialize_number_from_string<'de, T, D>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: FromStr + Deserialize<'de>,
    T::Err: Display,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNumber<T> {
        String(String),
        Number(T),
    }

    match StringOrNumber::<T>::deserialize(deserializer)? {
        StringOrNumber::String(s) => s.parse::<T>().map_err(serde::de::Error::custom),
        StringOrNumber::Number(n) => Ok(n),
    }
}

/// Deserialize an optional number that may come as a string or int
fn deserialize_optional_number_from_string<'de, T, D>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: FromStr + Deserialize<'de>,
    T::Err: Display,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNumber<T> {
        String(String),
        Number(T),
        Null,
    }

    match Option::<StringOrNumber<T>>::deserialize(deserializer)? {
        Some(StringOrNumber::String(s)) if s.is_empty() => Ok(None),
        Some(StringOrNumber::String(s)) => s.parse::<T>().map(Some).map_err(serde::de::Error::custom),
        Some(StringOrNumber::Number(n)) => Ok(Some(n)),
        Some(StringOrNumber::Null) | None => Ok(None),
    }
}

/// Deserialize category_ids which can be array of strings or ints
fn deserialize_category_ids<'de, D>(deserializer: D) -> Result<Option<Vec<i32>>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrInt {
        String(String),
        Int(i32),
    }

    let opt: Option<Vec<StringOrInt>> = Option::deserialize(deserializer)?;

    match opt {
        Some(vec) => {
            let mut result = Vec::with_capacity(vec.len());
            for item in vec {
                match item {
                    StringOrInt::String(s) => {
                        match s.parse::<i32>() {
                            Ok(n) => result.push(n),
                            Err(_) => {
                                warn!(
                                    category_id = %s,
                                    "Failed to parse category_id string as i32, skipping"
                                );
                            }
                        }
                    }
                    StringOrInt::Int(n) => result.push(n),
                }
            }
            Ok(Some(result))
        }
        None => Ok(None),
    }
}

/// Raw authentication response from Xtream Codes API
#[derive(Debug, Deserialize)]
pub struct XtreamAuthResponse {
    pub user_info: UserInfo,
    pub server_info: Option<ServerInfo>,
}

/// User information from Xtream API response
#[derive(Debug, Deserialize)]
pub struct UserInfo {
    pub username: Option<String>,
    pub auth: i32,
    pub status: Option<String>,
    /// Unix timestamp as string (e.g., "1735689600")
    pub exp_date: Option<String>,
    /// Number as string (e.g., "2")
    pub max_connections: Option<String>,
    /// Number as string (e.g., "0")
    pub active_cons: Option<String>,
    /// "1" or "0" as string
    pub is_trial: Option<String>,
    pub created_at: Option<String>,
    pub allowed_output_formats: Option<Vec<String>>,
    pub message: Option<String>,
}

/// Server information from Xtream API response
#[derive(Debug, Deserialize)]
pub struct ServerInfo {
    pub url: Option<String>,
    pub port: Option<String>,
    pub https_port: Option<String>,
    pub server_protocol: Option<String>,
    pub timestamp_now: Option<i64>,
    pub time_now: Option<String>,
    pub timezone: Option<String>,
}

/// Parsed account information (our internal representation)
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub is_authenticated: bool,
    pub status: String,
    pub expiry_date: Option<DateTime<Utc>>,
    pub max_connections: i32,
    pub active_connections: i32,
    pub is_trial: bool,
}

/// Live stream from Xtream get_live_streams API
/// Note: Xtream APIs are inconsistent - some fields may be strings or ints
#[derive(Debug, Deserialize, Clone)]
pub struct XtreamLiveStream {
    #[serde(deserialize_with = "deserialize_number_from_string")]
    pub num: i32,
    pub name: String,
    pub stream_type: String,
    #[serde(deserialize_with = "deserialize_number_from_string")]
    pub stream_id: i32,
    pub stream_icon: Option<String>,
    pub epg_channel_id: Option<String>,
    pub added: Option<String>,
    /// Can be string or int in API
    pub category_id: Option<String>,
    /// Can be array of strings or ints
    #[serde(default, deserialize_with = "deserialize_category_ids")]
    pub category_ids: Option<Vec<i32>>,
    pub custom_sid: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_number_from_string")]
    pub tv_archive: Option<i32>,
    pub direct_source: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_number_from_string")]
    pub tv_archive_duration: Option<i32>,
}

/// Category from Xtream get_live_categories API
#[derive(Debug, Deserialize, Clone)]
pub struct XtreamCategory {
    pub category_id: String,
    pub category_name: String,
    pub parent_id: Option<i32>,
}

impl From<XtreamAuthResponse> for AccountInfo {
    fn from(response: XtreamAuthResponse) -> Self {
        let user = response.user_info;

        // Parse exp_date from Unix timestamp string to DateTime
        let expiry_date = user
            .exp_date
            .and_then(|s| s.parse::<i64>().ok())
            .and_then(|ts| DateTime::from_timestamp(ts, 0));

        // Parse max_connections from string to i32 (default to 1)
        let max_connections = user
            .max_connections
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(1);

        // Parse active_cons from string to i32 (default to 0)
        let active_connections = user
            .active_cons
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(0);

        // Parse is_trial from string ("1" = true)
        let is_trial = user.is_trial.map(|s| s == "1").unwrap_or(false);

        AccountInfo {
            is_authenticated: user.auth == 1,
            status: user.status.unwrap_or_else(|| "Unknown".to_string()),
            expiry_date,
            max_connections,
            active_connections,
            is_trial,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_full_response() {
        let response = XtreamAuthResponse {
            user_info: UserInfo {
                username: Some("testuser".to_string()),
                auth: 1,
                status: Some("Active".to_string()),
                exp_date: Some("1735689600".to_string()), // 2025-01-01 00:00:00 UTC
                max_connections: Some("3".to_string()),
                active_cons: Some("1".to_string()),
                is_trial: Some("0".to_string()),
                created_at: Some("1704067200".to_string()),
                allowed_output_formats: Some(vec!["m3u8".to_string(), "ts".to_string()]),
                message: None,
            },
            server_info: Some(ServerInfo {
                url: Some("http://example.com".to_string()),
                port: Some("8080".to_string()),
                https_port: Some("443".to_string()),
                server_protocol: Some("http".to_string()),
                timestamp_now: Some(1704153600),
                time_now: Some("2026-01-02 12:00:00".to_string()),
                timezone: Some("UTC".to_string()),
            }),
        };

        let info = AccountInfo::from(response);

        assert!(info.is_authenticated);
        assert_eq!(info.status, "Active");
        assert!(info.expiry_date.is_some());
        assert_eq!(info.max_connections, 3);
        assert_eq!(info.active_connections, 1);
        assert!(!info.is_trial);
    }

    #[test]
    fn test_parse_minimal_response() {
        let response = XtreamAuthResponse {
            user_info: UserInfo {
                username: None,
                auth: 1,
                status: None,
                exp_date: None,
                max_connections: None,
                active_cons: None,
                is_trial: None,
                created_at: None,
                allowed_output_formats: None,
                message: None,
            },
            server_info: None,
        };

        let info = AccountInfo::from(response);

        assert!(info.is_authenticated);
        assert_eq!(info.status, "Unknown");
        assert!(info.expiry_date.is_none());
        assert_eq!(info.max_connections, 1); // Default
        assert_eq!(info.active_connections, 0); // Default
        assert!(!info.is_trial); // Default
    }

    #[test]
    fn test_parse_failed_auth_response() {
        let response = XtreamAuthResponse {
            user_info: UserInfo {
                username: None,
                auth: 0,
                status: None,
                exp_date: None,
                max_connections: None,
                active_cons: None,
                is_trial: None,
                created_at: None,
                allowed_output_formats: None,
                message: Some("Invalid credentials".to_string()),
            },
            server_info: None,
        };

        let info = AccountInfo::from(response);

        assert!(!info.is_authenticated);
    }

    #[test]
    fn test_parse_trial_account() {
        let response = XtreamAuthResponse {
            user_info: UserInfo {
                username: Some("trialuser".to_string()),
                auth: 1,
                status: Some("Active".to_string()),
                exp_date: None,
                max_connections: Some("1".to_string()),
                active_cons: Some("0".to_string()),
                is_trial: Some("1".to_string()),
                created_at: None,
                allowed_output_formats: None,
                message: None,
            },
            server_info: None,
        };

        let info = AccountInfo::from(response);

        assert!(info.is_authenticated);
        assert!(info.is_trial);
    }

    #[test]
    fn test_parse_invalid_exp_date_returns_none() {
        let response = XtreamAuthResponse {
            user_info: UserInfo {
                username: Some("testuser".to_string()),
                auth: 1,
                status: Some("Active".to_string()),
                exp_date: Some("not-a-number".to_string()),
                max_connections: Some("2".to_string()),
                active_cons: Some("0".to_string()),
                is_trial: Some("0".to_string()),
                created_at: None,
                allowed_output_formats: None,
                message: None,
            },
            server_info: None,
        };

        let info = AccountInfo::from(response);
        assert!(info.expiry_date.is_none());
    }

    #[test]
    fn test_parse_invalid_max_connections_defaults_to_1() {
        let response = XtreamAuthResponse {
            user_info: UserInfo {
                username: Some("testuser".to_string()),
                auth: 1,
                status: Some("Active".to_string()),
                exp_date: None,
                max_connections: Some("invalid".to_string()),
                active_cons: Some("0".to_string()),
                is_trial: Some("0".to_string()),
                created_at: None,
                allowed_output_formats: None,
                message: None,
            },
            server_info: None,
        };

        let info = AccountInfo::from(response);
        assert_eq!(info.max_connections, 1);
    }

    #[test]
    fn test_parse_negative_connections_handled() {
        let response = XtreamAuthResponse {
            user_info: UserInfo {
                username: Some("testuser".to_string()),
                auth: 1,
                status: Some("Active".to_string()),
                exp_date: None,
                max_connections: Some("-1".to_string()),
                active_cons: Some("-5".to_string()),
                is_trial: Some("0".to_string()),
                created_at: None,
                allowed_output_formats: None,
                message: None,
            },
            server_info: None,
        };

        let info = AccountInfo::from(response);
        // Negative values should parse but we accept them (server's data)
        assert_eq!(info.max_connections, -1);
        assert_eq!(info.active_connections, -5);
    }

    #[test]
    fn test_live_stream_with_string_numbers() {
        // Tests deserialize_number_from_string with string values
        let json = r#"{
            "num": "42",
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": "123"
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.num, 42);
        assert_eq!(stream.stream_id, 123);
    }

    #[test]
    fn test_live_stream_with_int_numbers() {
        // Tests deserialize_number_from_string with int values
        let json = r#"{
            "num": 42,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 123
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.num, 42);
        assert_eq!(stream.stream_id, 123);
    }

    #[test]
    fn test_live_stream_optional_number_as_string() {
        // Tests deserialize_optional_number_from_string
        let json = r#"{
            "num": 1,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 100,
            "tv_archive": "1",
            "tv_archive_duration": "7"
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.tv_archive, Some(1));
        assert_eq!(stream.tv_archive_duration, Some(7));
    }

    #[test]
    fn test_live_stream_optional_number_as_int() {
        // Tests deserialize_optional_number_from_string with int values
        let json = r#"{
            "num": 1,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 100,
            "tv_archive": 1,
            "tv_archive_duration": 7
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.tv_archive, Some(1));
        assert_eq!(stream.tv_archive_duration, Some(7));
    }

    #[test]
    fn test_live_stream_optional_number_empty_string() {
        // Tests deserialize_optional_number_from_string with empty string (should be None)
        let json = r#"{
            "num": 1,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 100,
            "tv_archive": "",
            "tv_archive_duration": ""
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.tv_archive, None);
        assert_eq!(stream.tv_archive_duration, None);
    }

    #[test]
    fn test_live_stream_category_ids_as_strings() {
        // Tests deserialize_category_ids with string array
        let json = r#"{
            "num": 1,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 100,
            "category_ids": ["1", "2", "3"]
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.category_ids, Some(vec![1, 2, 3]));
    }

    #[test]
    fn test_live_stream_category_ids_as_ints() {
        // Tests deserialize_category_ids with int array
        let json = r#"{
            "num": 1,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 100,
            "category_ids": [1, 2, 3]
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.category_ids, Some(vec![1, 2, 3]));
    }

    #[test]
    fn test_live_stream_category_ids_mixed() {
        // Tests deserialize_category_ids with mixed string/int array
        let json = r#"{
            "num": 1,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 100,
            "category_ids": ["1", 2, "3"]
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        assert_eq!(stream.category_ids, Some(vec![1, 2, 3]));
    }

    #[test]
    fn test_live_stream_category_ids_with_unparseable_skipped() {
        // Tests that unparseable category_ids are skipped (with warning logged)
        let json = r#"{
            "num": 1,
            "name": "Test Channel",
            "stream_type": "live",
            "stream_id": 100,
            "category_ids": ["1", "invalid", "3"]
        }"#;

        let stream: XtreamLiveStream = serde_json::from_str(json).unwrap();
        // "invalid" should be skipped, only 1 and 3 remain
        assert_eq!(stream.category_ids, Some(vec![1, 3]));
    }
}
