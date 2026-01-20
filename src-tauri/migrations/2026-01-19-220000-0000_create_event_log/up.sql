-- Story 3-4: Create event_log table for logging system events
-- This table stores events for provider changes, connection issues, etc.

CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now')) NOT NULL,
    level TEXT CHECK(level IN ('info', 'warn', 'error')) NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    is_read INTEGER DEFAULT 0 NOT NULL
);

-- Index for efficient timestamp-based queries (newest first)
CREATE INDEX IF NOT EXISTS idx_event_log_timestamp ON event_log(timestamp DESC);

-- Index for filtering by level
CREATE INDEX IF NOT EXISTS idx_event_log_level ON event_log(level);

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_event_log_category ON event_log(category);

-- Index for unread count queries
CREATE INDEX IF NOT EXISTS idx_event_log_is_read ON event_log(is_read);
