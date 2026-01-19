-- Remove EPG schedule settings
-- Story 2-6: Implement Scheduled EPG Refresh

DELETE FROM settings WHERE key = 'epg_refresh_hour';
DELETE FROM settings WHERE key = 'epg_refresh_minute';
DELETE FROM settings WHERE key = 'epg_refresh_enabled';
DELETE FROM settings WHERE key = 'epg_last_scheduled_refresh';
