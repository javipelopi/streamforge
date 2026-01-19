use diesel::prelude::*;

use crate::db::schema::settings;

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
