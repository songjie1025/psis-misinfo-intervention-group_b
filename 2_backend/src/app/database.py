"""database.py — SQLite Database Setup

Creates two tables:
  - users: stores BFI-10 Big Five scores and computed risk score
  - behavior_logs: tracks user interactions with posts and interventions

Posts themselves live in 3_mockup-website/mock-data/posts.json
(controlled experiment environment). The backend never stores posts —
the browser extension sends post content to /api/detect when needed.

Provides:
  - init_db(): creates tables on first startup
  - get_db(): returns a database connection for use in API routes
"""

import os
import sqlite3

# Database file lives at 2_backend/app.db (project root, not inside src/)
DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "app.db",
)

# ---------------------------------------------------------------
# Schema
# ---------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT UNIQUE NOT NULL,
    openness      REAL,           -- BFI-10 score (2–10)
    conscientiousness REAL,
    extraversion  REAL,
    agreeableness REAL,
    neuroticism   REAL,
    risk_score    REAL DEFAULT 0, -- computed risk score (0–1)
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS behavior_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    post_identifier TEXT NOT NULL,     -- post id from mockup JSON, or hash of post content
    action          TEXT NOT NULL,     -- 'view' | 'like' | 'share' | 'dismiss_intervention' | 'read_intervention'
    dwell_time_ms   INTEGER,           -- time spent viewing post in milliseconds
    scroll_speed    REAL,              -- pixels per second when scrolling past post
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
"""


# ---------------------------------------------------------------
# Database Functions
# ---------------------------------------------------------------

def get_db():
    """Return a new database connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if missing. Safe to call on every startup."""
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    print(f"[database] Initialized at {DB_PATH}")


# Run when this file is executed directly
if __name__ == "__main__":
    init_db()
