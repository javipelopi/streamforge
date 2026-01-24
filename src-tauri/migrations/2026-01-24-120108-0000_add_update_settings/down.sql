-- Rollback Story 6-5: Auto-Update Mechanism settings

DELETE FROM settings WHERE key = 'auto_check_updates';
DELETE FROM settings WHERE key = 'last_update_check';
