-- Story 6-5: Auto-Update Mechanism
-- Add update-related settings to the settings table

INSERT INTO settings (key, value) VALUES ('auto_check_updates', 'true');
INSERT INTO settings (key, value) VALUES ('last_update_check', NULL);
