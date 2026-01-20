-- Rollback: Remove M3U performance indexes

DROP INDEX IF EXISTS idx_xmltv_channel_settings_enabled;
DROP INDEX IF EXISTS idx_xmltv_channel_settings_enabled_order;
DROP INDEX IF EXISTS idx_channel_mappings_xmltv_channel_id;
DROP INDEX IF EXISTS idx_channel_mappings_logo_lookup;
