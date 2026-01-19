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

diesel::table! {
    xmltv_sources (id) {
        id -> Nullable<Integer>,
        name -> Text,
        url -> Text,
        format -> Text,
        refresh_hour -> Integer,
        last_refresh -> Nullable<Text>,
        is_active -> Integer,
        created_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    xtream_channels (id) {
        id -> Nullable<Integer>,
        account_id -> Integer,
        stream_id -> Integer,
        name -> Text,
        stream_icon -> Nullable<Text>,
        category_id -> Nullable<Integer>,
        category_name -> Nullable<Text>,
        qualities -> Nullable<Text>,
        epg_channel_id -> Nullable<Text>,
        tv_archive -> Nullable<Integer>,
        tv_archive_duration -> Nullable<Integer>,
        added_at -> Nullable<Text>,
        updated_at -> Nullable<Text>,
    }
}

diesel::joinable!(xtream_channels -> accounts (account_id));

diesel::allow_tables_to_appear_in_same_query!(accounts, settings, xmltv_sources, xtream_channels,);
