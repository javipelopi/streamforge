-- Add EPG schedule settings with defaults
-- Story 2-6: Implement Scheduled EPG Refresh

-- Default schedule: 4:00 AM, enabled
INSERT OR IGNORE INTO settings (key, value) VALUES ('epg_refresh_hour', '4');
INSERT OR IGNORE INTO settings (key, value) VALUES ('epg_refresh_minute', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('epg_refresh_enabled', 'true');
-- Note: epg_last_scheduled_refresh is set dynamically after first scheduled refresh
