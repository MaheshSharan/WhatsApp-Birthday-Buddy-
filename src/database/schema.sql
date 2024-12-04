-- Create birthdays table if not exists
CREATE TABLE IF NOT EXISTS birthdays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create AFK status table if not exists
CREATE TABLE IF NOT EXISTS afk_status (
    is_afk BOOLEAN DEFAULT 0,
    afk_since DATETIME,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create bot stats table if not exists
CREATE TABLE IF NOT EXISTS bot_stats (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
