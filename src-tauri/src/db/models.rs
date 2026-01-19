use diesel::prelude::*;

use crate::db::schema::{accounts, settings};

#[derive(Queryable, Selectable, Insertable, Debug, Clone)]
#[diesel(table_name = settings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Setting {
    pub key: String,
    pub value: String,
}

impl Setting {
    pub fn new(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
        }
    }
}

/// Account model for querying existing accounts
#[derive(Queryable, Selectable, Identifiable, Debug, Clone)]
#[diesel(table_name = accounts)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Account {
    pub id: Option<i32>,
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password_encrypted: Vec<u8>,
    pub max_connections: i32,
    pub is_active: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// New account model for inserting records
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = accounts)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewAccount {
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password_encrypted: Vec<u8>,
    pub max_connections: i32,
    pub is_active: i32,
}

impl NewAccount {
    pub fn new(
        name: impl Into<String>,
        server_url: impl Into<String>,
        username: impl Into<String>,
        password_encrypted: Vec<u8>,
    ) -> Self {
        Self {
            name: name.into(),
            server_url: server_url.into(),
            username: username.into(),
            password_encrypted,
            max_connections: 1,
            is_active: 1,
        }
    }
}
