-- Create accounts table for storing Xtream Codes credentials
-- Password is stored as AES-256-GCM encrypted blob
CREATE TABLE accounts (
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

-- Index for active accounts filtering
CREATE INDEX idx_accounts_is_active ON accounts(is_active);
