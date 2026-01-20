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
    channel_mappings (id) {
        id -> Nullable<Integer>,
        xmltv_channel_id -> Integer,
        xtream_channel_id -> Integer,
        match_confidence -> Nullable<Float>,
        is_manual -> Nullable<Integer>,
        is_primary -> Nullable<Integer>,
        stream_priority -> Nullable<Integer>,
        created_at -> Text,
    }
}

diesel::table! {
    event_log (id) {
        id -> Nullable<Integer>,
        timestamp -> Text,
        level -> Text,
        category -> Text,
        message -> Text,
        details -> Nullable<Text>,
        is_read -> Integer,
    }
}

diesel::table! {
    programs (id) {
        id -> Nullable<Integer>,
        xmltv_channel_id -> Integer,
        title -> Text,
        description -> Nullable<Text>,
        start_time -> Text,
        end_time -> Text,
        category -> Nullable<Text>,
        episode_info -> Nullable<Text>,
        created_at -> Text,
    }
}

diesel::table! {
    settings (key) {
        key -> Text,
        value -> Text,
    }
}

diesel::table! {
    xmltv_channel_settings (id) {
        id -> Nullable<Integer>,
        xmltv_channel_id -> Integer,
        is_enabled -> Nullable<Integer>,
        plex_display_order -> Nullable<Integer>,
        created_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    xmltv_channels (id) {
        id -> Nullable<Integer>,
        source_id -> Integer,
        channel_id -> Text,
        display_name -> Text,
        icon -> Nullable<Text>,
        created_at -> Text,
        updated_at -> Text,
        is_synthetic -> Nullable<Integer>,
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

diesel::joinable!(channel_mappings -> xmltv_channels (xmltv_channel_id));
diesel::joinable!(channel_mappings -> xtream_channels (xtream_channel_id));
diesel::joinable!(programs -> xmltv_channels (xmltv_channel_id));
diesel::joinable!(xmltv_channel_settings -> xmltv_channels (xmltv_channel_id));
diesel::joinable!(xmltv_channels -> xmltv_sources (source_id));
diesel::joinable!(xtream_channels -> accounts (account_id));

diesel::allow_tables_to_appear_in_same_query!(
    accounts,
    channel_mappings,
    event_log,
    programs,
    settings,
    xmltv_channel_settings,
    xmltv_channels,
    xmltv_sources,
    xtream_channels,
);
