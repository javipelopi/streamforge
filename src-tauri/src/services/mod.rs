//! Services layer — pure business logic operating on `&mut SqliteConnection`.
//!
//! Each module mirrors a domain concept from `commands/` but carries **no** Tauri
//! or Axum dependency. Both the Tauri command handlers and the REST API handlers
//! call into these services, eliminating the duplication that existed before.
//!
//! # Convention
//!
//! Every public function takes `conn: &mut SqliteConnection` as its first argument.
//! Framework-specific concerns (Tauri `State`, Axum `State`, `AppHandle`, progress
//! events) stay in the calling layer.

pub mod accounts;
pub mod acestream;
pub mod channels;
pub mod epg;
pub mod logs;
pub mod m3u;
pub mod matcher;
pub mod matching_profiles;
pub mod settings;
pub mod config;
pub mod xmltv_channels;
