// @generated automatically by Diesel CLI.

diesel::table! {
    accounts (id) {
        id -> Nullable<Integer>,
        name -> Text,
        server_url -> Text,
        username -> Text,
        password_encrypted -> Binary,
        max_connections -> Integer,
        is_active -> Integer,
        created_at -> Text,
        updated_at -> Text,
        expiry_date -> Nullable<Text>,
        max_connections_actual -> Nullable<Integer>,
        active_connections -> Nullable<Integer>,
        last_check -> Nullable<Text>,
        connection_status -> Nullable<Text>,
    }
}

diesel::table! {
    settings (key) {
        key -> Text,
        value -> Text,
    }
}

diesel::allow_tables_to_appear_in_same_query!(accounts, settings,);
