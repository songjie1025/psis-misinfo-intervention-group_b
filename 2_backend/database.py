"""database.py — SQLite Database Setup & Seed Data

Creates three tables:
  - users: stores BFI-10 Big Five scores and risk score
  - posts: mock social media posts with misinformation labels
  - behavior_logs: tracks user interactions with posts and interventions

Provides:
  - init_db(): creates tables and seeds mock data on startup
  - get_db(): returns a database connection for use in API routes
"""

import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

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

CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    author        TEXT NOT NULL,
    content       TEXT NOT NULL,
    category      TEXT NOT NULL,  -- 'health' | 'politics' | 'tech' | 'science'
    is_misinfo    INTEGER NOT NULL, -- 1 = false, 0 = true
    claim_text    TEXT,           -- extracted claim for ClaimBuster
    fact_check    TEXT,           -- pre-verified explanation
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS behavior_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    post_id       INTEGER NOT NULL,
    action        TEXT NOT NULL,  -- 'view' | 'like' | 'share' | 'dismiss_intervention' | 'read_intervention'
    dwell_time_ms INTEGER,        -- time spent viewing post in milliseconds
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
"""

# ---------------------------------------------------------------
# Mock Posts (20 posts: 10 true, 10 misinformation)
# ---------------------------------------------------------------

MOCK_POSTS = [
    # --- TRUE POSTS (is_misinfo=0) ---
    {
        "author": "health_reporter",
        "content": "WHO confirms that regular exercise reduces heart disease risk by up to 30%, according to a 10-year study involving 50,000 participants.",
        "category": "health",
        "is_misinfo": 0,
        "claim_text": "regular exercise reduces heart disease risk by 30%",
        "fact_check": "TRUE — WHO meta-analysis of 50+ studies confirms this finding."
    },
    {
        "author": "science_daily",
        "content": "NASA satellite data shows global average sea level has risen about 10 cm since 1993.",
        "category": "science",
        "is_misinfo": 0,
        "claim_text": "global sea level has risen 10 cm since 1993",
        "fact_check": "TRUE — NASA and NOAA satellite altimetry data confirm ~10.2 cm rise."
    },
    {
        "author": "tech_insider",
        "content": "Apple announced that all new iPhones will use USB-C charging ports starting from the iPhone 15 series.",
        "category": "tech",
        "is_misinfo": 0,
        "claim_text": "iPhone 15 uses USB-C",
        "fact_check": "TRUE — Apple switched to USB-C starting with iPhone 15 in 2023."
    },
    {
        "author": "policy_watch",
        "content": "The EU Parliament passed the Digital Services Act requiring large platforms to remove illegal content within 24 hours.",
        "category": "politics",
        "is_misinfo": 0,
        "claim_text": "EU Digital Services Act requires 24-hour content removal",
        "fact_check": "TRUE — The DSA came into force in 2024 with this provision."
    },
    {
        "author": "med_journal",
        "content": "A clinical trial published in The Lancet shows that a new malaria vaccine is 75% effective in children under 5.",
        "category": "health",
        "is_misinfo": 0,
        "claim_text": "new malaria vaccine 75% effective in children",
        "fact_check": "TRUE — R21/Matrix-M vaccine showed ~75% efficacy in Phase 3 trials."
    },
    {
        "author": "climate_now",
        "content": "Renewable energy sources accounted for over 30% of global electricity generation in 2024, per IEA report.",
        "category": "science",
        "is_misinfo": 0,
        "claim_text": "renewables accounted for 30% of global electricity in 2024",
        "fact_check": "TRUE — IEA data confirms renewables passed 30% in 2024."
    },
    {
        "author": "dev_news",
        "content": "Python remains the most popular programming language on GitHub for the 5th consecutive year according to Octoverse report.",
        "category": "tech",
        "is_misinfo": 0,
        "claim_text": "Python most popular language on GitHub 5 years running",
        "fact_check": "TRUE — GitHub Octoverse reports confirm this trend."
    },
    {
        "author": "election_watch",
        "content": "Voter turnout in the 2024 European Parliament elections was approximately 51%, according to official EU data.",
        "category": "politics",
        "is_misinfo": 0,
        "claim_text": "EU voter turnout 51% in 2024",
        "fact_check": "TRUE — Official EU election results confirm ~51.08%."
    },
    {
        "author": "nutrition_facts",
        "content": "Studies show that eating 5 servings of fruits and vegetables daily is associated with lower mortality risk.",
        "category": "health",
        "is_misinfo": 0,
        "claim_text": "5 servings of fruits/vegetables daily lowers mortality",
        "fact_check": "TRUE — Harvard School of Public Health meta-analysis supports this."
    },
    {
        "author": "ai_news",
        "content": "OpenAI released GPT-4o, a multimodal model that can process text, images, and audio in a single neural network.",
        "category": "tech",
        "is_misinfo": 0,
        "claim_text": "GPT-4o processes text, images, and audio natively",
        "fact_check": "TRUE — OpenAI announced and released GPT-4o in May 2024."
    },

    # --- MISINFORMATION POSTS (is_misinfo=1) ---
    {
        "author": "wellness_guru",
        "content": "Doctors are hiding the truth: drinking celery juice every morning cures cancer naturally without chemotherapy.",
        "category": "health",
        "is_misinfo": 1,
        "claim_text": "celery juice cures cancer",
        "fact_check": "FALSE — No scientific evidence supports this. Cancer treatments require clinical validation."
    },
    {
        "author": "conspiracy_daily",
        "content": "5G towers are secretly spreading a virus that causes headaches and insomnia. Multiple countries have banned 5G because of this.",
        "category": "science",
        "is_misinfo": 1,
        "claim_text": "5G towers spread virus causing health problems",
        "fact_check": "FALSE — Radio waves from 5G cannot transmit viruses. No country has banned 5G for health reasons."
    },
    {
        "author": "crypto_king",
        "content": "This new cryptocurrency will 100x in the next 48 hours. Elon Musk is secretly investing billions. Don't miss out!",
        "category": "tech",
        "is_misinfo": 1,
        "claim_text": "crypto will 100x with Elon Musk backing",
        "fact_check": "FALSE — No evidence of Musk investment. Pump-and-dump scheme warning."
    },
    {
        "author": "free_thinker",
        "content": "The government is using vaccines to implant microchips in citizens. A whistleblower doctor confirmed this last week.",
        "category": "health",
        "is_misinfo": 1,
        "claim_text": "vaccines contain microchips",
        "fact_check": "FALSE — Repeatedly debunked. Vaccines contain no tracking devices. The 'whistleblower' claim is fabricated."
    },
    {
        "author": "political_insider",
        "content": "The election was completely rigged. Millions of illegal votes were counted and officials are covering it up.",
        "category": "politics",
        "is_misinfo": 1,
        "claim_text": "election rigged with millions of illegal votes",
        "fact_check": "FALSE — Multiple audits and court rulings found no evidence of widespread fraud."
    },
    {
        "author": "natural_healer",
        "content": "Big Pharma paid scientists to fake climate change data so they can sell more medications. The Earth is actually cooling.",
        "category": "science",
        "is_misinfo": 1,
        "claim_text": "climate change data is faked by pharma companies",
        "fact_check": "FALSE — Climate data is independently verified by thousands of scientists worldwide across multiple agencies."
    },
    {
        "author": "truth_seeker_99",
        "content": "The WHO admitted that COVID-19 was created in a lab as a bioweapon. This was leaked in internal documents.",
        "category": "health",
        "is_misinfo": 1,
        "claim_text": "WHO admitted COVID-19 was a lab-created bioweapon",
        "fact_check": "FALSE — No such WHO admission exists. The origin is still under investigation, and no evidence supports the bioweapon claim."
    },
    {
        "author": "clickbait_news",
        "content": "BREAKING: A famous actor just died in a plane crash! Details are still emerging but multiple sources confirm.",
        "category": "politics",
        "is_misinfo": 1,
        "claim_text": "famous actor died in plane crash",
        "fact_check": "FALSE — Celebrity death hoax. No credible news outlets have reported this."
    },
    {
        "author": "quantum_hacker",
        "content": "Scientists have accidentally opened a portal to another dimension at CERN. The government is hiding this from the public.",
        "category": "tech",
        "is_misinfo": 1,
        "claim_text": "CERN opened a portal to another dimension",
        "fact_check": "FALSE — CERN conducts particle physics research, not interdimensional portals. This is a recurring internet hoax."
    },
    {
        "author": "angry_patriot",
        "content": "Immigrants are receiving $5,000 monthly checks from the government while citizens get nothing. This is official policy now.",
        "category": "politics",
        "is_misinfo": 1,
        "claim_text": "immigrants receive $5000 monthly government checks",
        "fact_check": "FALSE — No such policy exists. This is a common disinformation narrative debunked by multiple fact-checking organizations."
    },
]


# ---------------------------------------------------------------
# Database Functions
# ---------------------------------------------------------------

def get_db():
    """Return a new database connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # better concurrency
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables and seed mock posts. Safe to call on every startup."""
    conn = get_db()
    conn.executescript(SCHEMA)

    # Seed posts only if the table is empty
    cursor = conn.execute("SELECT COUNT(*) FROM posts")
    count = cursor.fetchone()[0]
    if count == 0:
        for post in MOCK_POSTS:
            conn.execute(
                """INSERT INTO posts (author, content, category, is_misinfo, claim_text, fact_check)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (post["author"], post["content"], post["category"],
                 post["is_misinfo"], post["claim_text"], post["fact_check"])
            )
        conn.commit()

    conn.close()
    print(f"[database] Initialized. {max(count, len(MOCK_POSTS))} posts in database.")


# Run when this file is executed directly
if __name__ == "__main__":
    init_db()
