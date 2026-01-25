-- Story 6-5: Auto-Update Mechanism
-- Add update-related settings to the settings table

INSERT INTO settings (key, value) VALUES ('auto_check_updates', 'true');
-- Note: last_update_check is only created when first update check happens
-- The code handles the case when it doesn't exist
