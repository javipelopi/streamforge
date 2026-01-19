-- SQLite doesn't support DROP COLUMN prior to version 3.35.0
-- For compatibility, we'll create a new table without the status fields and migrate data

-- Create backup table with original schema
CREATE TABLE accounts_backup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted BLOB NOT NULL,
    max_connections INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data (excluding new status columns)
INSERT INTO accounts_backup (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
SELECT id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at
FROM accounts;

-- Drop original table
DROP TABLE accounts;

-- Rename backup to original name
ALTER TABLE accounts_backup RENAME TO accounts;

-- Recreate index
CREATE INDEX idx_accounts_is_active ON accounts(is_active);
