//! XMLTV parsing and fetching module
//!
//! This module provides functionality to download, decompress, and parse XMLTV
//! format EPG (Electronic Program Guide) data.

pub mod fetcher;
pub mod parser;
pub mod types;

pub use fetcher::fetch_xmltv;
pub use parser::parse_xmltv_data;
pub use types::{ParsedChannel, ParsedProgram, XmltvError};
