pub mod connection;
pub mod models;
pub mod schema;

// Note: These exports are used by the lib crate (server module, tests), not the bin crate
// Clippy's dead_code lint doesn't understand the lib/bin split
#[allow(unused_imports)]
pub use connection::{establish_connection, get_db_path, run_migrations, DbConnection, DbPool, DbPooledConnection};
pub use models::{
    Account, AccountStatusUpdate, NewAccount, NewProgram, NewXmltvChannel, NewXmltvSource,
    NewXtreamChannel, Program, Setting, XmltvChannel, XmltvSource, XmltvSourceUpdate,
    XtreamChannel, XtreamChannelUpdate,
};
