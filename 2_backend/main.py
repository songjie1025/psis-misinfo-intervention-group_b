"""
main.py — FastAPI Backend for Misinformation Intervention Platform

Provides 6 API endpoints:
  GET  /api/posts              — return all mock posts from database
  POST /api/detect             — analyze a post for misinformation (LLM + ClaimBuster stub)
  POST /api/bigfive            — submit user's BFI-10 test results
  POST /api/behavior           — log a user interaction (view, like, share, etc.)
  GET  /api/intervention/{id}  — get personalized intervention for a specific post
  GET  /api/dashboard/{sid}    — return dashboard stats for a user session

Start with:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import database

app = FastAPI(title="Misinfo Intervention API", version="0.1.0")

# Allow requests from the frontend (browser opening local HTML file)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------
# Pydantic Models (request/response shapes)
# ---------------------------------------------------------------

class BigFiveScores(BaseModel):
    session_id: str
    openness: float
    conscientiousness: float
    extraversion: float
    agreeableness: float
    neuroticism: float


class BehaviorEvent(BaseModel):
    session_id: str
    post_id: int
    action: str          # 'view' | 'like' | 'share' | 'dismiss_intervention' | 'read_intervention'
    dwell_time_ms: int = 0


class DetectRequest(BaseModel):
    post_id: int
    post_content: str


# ---------------------------------------------------------------
# Startup — initialize database
# ---------------------------------------------------------------

@app.on_event("startup")
def startup():
    database.init_db()


# ---------------------------------------------------------------
# Routes
# ---------------------------------------------------------------

@app.get("/api/posts")
def get_posts():
    """Return all posts from the database as a JSON array."""
    conn = database.get_db()
    rows = conn.execute(
        "SELECT id, author, content, category, is_misinfo, claim_text FROM posts"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/detect")
def detect_misinformation(req: DetectRequest):
    """
    Analyze a post for misinformation.
    Currently returns the pre-labeled ground truth from the database.
    In production: call ClaimBuster API → if flagged, call Gemini Flash for deeper analysis.
    """
    conn = database.get_db()
    row = conn.execute(
        "SELECT is_misinfo, fact_check FROM posts WHERE id = ?", (req.post_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Post not found")

    return {
        "post_id": req.post_id,
        "is_misinformation": bool(row["is_misinfo"]),
        "fact_check": row["fact_check"],
        "confidence": 1.0  # ground truth for prototype
    }


@app.post("/api/bigfive")
def submit_bigfive(scores: BigFiveScores):
    """
    Store a user's BFI-10 Big Five personality scores.
    Creates a new user if session_id is new, otherwise updates existing scores.
    """
    conn = database.get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE session_id = ?", (scores.session_id,)
    ).fetchone()

    if existing:
        conn.execute(
            """UPDATE users SET openness=?, conscientiousness=?, extraversion=?,
               agreeableness=?, neuroticism=? WHERE session_id=?""",
            (scores.openness, scores.conscientiousness, scores.extraversion,
             scores.agreeableness, scores.neuroticism, scores.session_id)
        )
    else:
        conn.execute(
            """INSERT INTO users (session_id, openness, conscientiousness,
               extraversion, agreeableness, neuroticism)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (scores.session_id, scores.openness, scores.conscientiousness,
             scores.extraversion, scores.agreeableness, scores.neuroticism)
        )
    conn.commit()
    conn.close()
    return {"status": "ok", "session_id": scores.session_id}


@app.post("/api/behavior")
def log_behavior(event: BehaviorEvent):
    """
    Log a user behavior event (view, like, share, intervention interaction).
    This data feeds into the risk score calculation and dashboard.
    """
    conn = database.get_db()

    # Resolve session_id to user_id
    user = conn.execute(
        "SELECT id FROM users WHERE session_id = ?", (event.session_id,)
    ).fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User session not found. Submit BFI-10 first.")

    conn.execute(
        """INSERT INTO behavior_logs (user_id, post_id, action, dwell_time_ms)
           VALUES (?, ?, ?, ?)""",
        (user["id"], event.post_id, event.action, event.dwell_time_ms)
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.get("/api/intervention/{post_id}")
def get_intervention(post_id: int, session_id: str = ""):
    """
    Return a personalized intervention for a post.
    Intervention type is selected based on:
      - Post's misinformation label
      - User's Big Five profile (if available)
      - User's risk score
    Returns one of three intervention types:
      - Type 1: Label (simple warning badge)
      - Type 2: Justification (detailed explanation)
      - Type 3: Interruption (full-screen pause before interaction)
    """
    conn = database.get_db()

    # Get post info
    post = conn.execute(
        "SELECT * FROM posts WHERE id = ?", (post_id,)
    ).fetchone()

    if not post:
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")

    # Get user profile if session_id provided
    user = None
    if session_id:
        user = conn.execute(
            "SELECT * FROM users WHERE session_id = ?", (session_id,)
        ).fetchone()

    conn.close()

    # Determine intervention type (simple rule-based for prototype)
    intervention_type = select_intervention_type(user, dict(post))

    interventions = {
        "label": {
            "type": "label",
            "badge_text": "⚠️ Independent fact-checkers say this is FALSE",
            "color": "#E0245E",  # red
            "action_text": "Learn why →"
        },
        "justification": {
            "type": "justification",
            "title": "Why this is misleading",
            "explanation": post["fact_check"],
            "source": "Verified by multiple fact-checking organizations",
            "action_text": "View sources"
        },
        "interruption": {
            "type": "interruption",
            "title": "Before you interact...",
            "body": "This post contains information that fact-checkers have flagged as false. Are you sure you want to continue?",
            "confirm_text": "See post anyway",
            "cancel_text": "Go back to feed"
        }
    }

    return interventions.get(intervention_type, interventions["label"])


@app.get("/api/dashboard/{session_id}")
def get_dashboard(session_id: str):
    """
    Return dashboard statistics for a user:
      - Topic diversity (posts viewed per category)
      - Misinformation count (how many misinfo posts were in their feed)
      - Intervention stats (shown vs engaged)
      - Personalized tips based on Big Five profile
    """
    conn = database.get_db()

    user = conn.execute(
        "SELECT * FROM users WHERE session_id = ?", (session_id,)
    ).fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    # Topic diversity: count posts viewed by category
    topic_diversity = {}
    topic_rows = conn.execute(
        """SELECT p.category, COUNT(*) as count
           FROM behavior_logs bl
           JOIN posts p ON bl.post_id = p.id
           WHERE bl.user_id = ? AND bl.action = 'view'
           GROUP BY p.category""",
        (user["id"],)
    ).fetchall()
    for row in topic_rows:
        topic_diversity[row["category"]] = row["count"]

    # Misinformation exposure
    misinfo_count = conn.execute(
        """SELECT COUNT(*) as count
           FROM behavior_logs bl
           JOIN posts p ON bl.post_id = p.id
           WHERE bl.user_id = ? AND p.is_misinfo = 1 AND bl.action = 'view'""",
        (user["id"],)
    ).fetchone()["count"]

    total_views = conn.execute(
        "SELECT COUNT(*) as count FROM behavior_logs WHERE user_id = ? AND action = 'view'",
        (user["id"],)
    ).fetchone()["count"]

    # Intervention engagement
    interventions_shown = conn.execute(
        "SELECT COUNT(*) as count FROM behavior_logs WHERE user_id = ? AND action = 'dismiss_intervention'",
        (user["id"],)
    ).fetchone()["count"]
    interventions_engaged = conn.execute(
        "SELECT COUNT(*) as count FROM behavior_logs WHERE user_id = ? AND action = 'read_intervention'",
        (user["id"],)
    ).fetchone()["count"]

    conn.close()

    # Generate personalized tips based on Big Five
    tips = generate_bigfive_tips(dict(user))

    return {
        "session_id": session_id,
        "topic_diversity": topic_diversity,
        "misinformation_exposure": {
            "misinfo_posts_seen": misinfo_count,
            "total_posts_seen": total_views,
            "misinfo_ratio": round(misinfo_count / max(total_views, 1), 2)
        },
        "intervention_stats": {
            "interventions_shown": interventions_shown,
            "interventions_engaged": interventions_engaged,
            "engagement_rate": round(interventions_engaged / max(interventions_shown, 1), 2)
        },
        "risk_score": user["risk_score"],
        "tips": tips
    }


# ---------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------

def select_intervention_type(user, post):
    """
    Select intervention type based on user's Big Five profile and risk score.

    Strategy:
      - High risk score (>0.7) → Interruption (Type 3) — strongest intervention
      - Low openness (<5) → Label (Type 1) — simple, direct
      - High openness (>=7) → Justification (Type 2) — detailed explanation
      - Default → Label (Type 1)
    """
    if not user:
        return "label"  # default when no user profile yet

    risk = user["risk_score"] or 0

    if risk > 0.7:
        return "interruption"

    if user["openness"] and user["openness"] < 5:
        return "label"
    elif user["openness"] and user["openness"] >= 7:
        return "justification"

    return "label"


def generate_bigfive_tips(user):
    """
    Generate personalized prevention tips based on Big Five dimensions.
    High scores: 7–10, Low scores: 2–5.
    """
    tips = []

    if user["openness"] and user["openness"] >= 7:
        tips.append("Your high curiosity is a strength! Keep exploring diverse perspectives, but verify before sharing.")
    elif user["openness"] and user["openness"] <= 4:
        tips.append("Try exploring content from sources you don't usually visit. Diverse perspectives help you spot misinformation.")

    if user["conscientiousness"] and user["conscientiousness"] >= 7:
        tips.append("Your careful nature helps you catch false claims. Keep double-checking before you interact.")
    elif user["conscientiousness"] and user["conscientiousness"] <= 4:
        tips.append("Before liking or sharing, take 3 seconds to check: who posted this and what is their source?")

    if user["extraversion"] and user["extraversion"] >= 7:
        tips.append("As someone socially active, remember: sharing is powerful. Verify claims before spreading them to your network.")
    elif user["extraversion"] and user["extraversion"] <= 4:
        tips.append("You don't need to share everything to participate. Your thoughtful silence is valuable too.")

    if user["agreeableness"] and user["agreeableness"] >= 7:
        tips.append("Your trusting nature is a gift, but stay alert — not every source deserves your trust. Check credentials.")
    elif user["agreeableness"] and user["agreeableness"] <= 4:
        tips.append("Your skepticism is a superpower. Use it to help others who might be more easily persuaded by false content.")

    if user["neuroticism"] and user["neuroticism"] >= 7:
        tips.append("Emotional content is designed to provoke a reaction. When a post makes you anxious, pause before responding.")
    elif user["neuroticism"] and user["neuroticism"] <= 4:
        tips.append("Your emotional stability helps you evaluate information calmly. Others may look to you for guidance in heated discussions.")

    if not tips:
        tips.append("Complete the personality test to receive personalized tips for spotting misinformation.")

    return tips
