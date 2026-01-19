-- Add account status fields for storing connection test results
-- These fields track the status from Xtream Codes API authentication

-- SQLite does not support adding multiple columns in one ALTER TABLE statement
-- Each column requires a separate statement

ALTER TABLE accounts ADD COLUMN expiry_date TEXT;
ALTER TABLE accounts ADD COLUMN max_connections_actual INTEGER;
ALTER TABLE accounts ADD COLUMN active_connections INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN last_check TEXT;
ALTER TABLE accounts ADD COLUMN connection_status TEXT DEFAULT 'unknown';

-- Add index on connection_status for filtering by status (connected/failed/unknown)
CREATE INDEX IF NOT EXISTS idx_accounts_connection_status ON accounts(connection_status);

-- Add index on last_check for finding stale accounts that need re-testing
CREATE INDEX IF NOT EXISTS idx_accounts_last_check ON accounts(last_check);
