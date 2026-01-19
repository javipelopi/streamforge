-- Drop event_log table and indexes
DROP INDEX IF EXISTS idx_event_log_is_read;
DROP INDEX IF EXISTS idx_event_log_category;
DROP INDEX IF EXISTS idx_event_log_level;
DROP INDEX IF EXISTS idx_event_log_timestamp;
DROP TABLE IF EXISTS event_log;
