"""
main.py — TruthLens FastAPI Server

Provides 6 API endpoints for the TruthLens prototype:
  1. GET  /api/posts                  — Return all mock posts
  2. POST /api/bigfive                — Submit BFI-10 scores, compute risk
  3. POST /api/behavior               — Log user interaction
  4. POST /api/detect                 — Check if a post is misinformation
  5. GET  /api/intervention/{post_id} — Get personalized intervention
  6. GET  /api/dashboard/{session_id} — Return aggregated stats + tips

Start with:
    cd 2_backend
    uv run uvicorn main:app --reload --port 8000

Then open http://localhost:8000/docs for interactive API docs.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import os

from dotenv import load_dotenv

from database import get_db, init_db
from intervention import calculate_risk_score, generate_tips, select_intervention

load_dotenv()  # Load .env at startup

# ---------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------

app = FastAPI(
    title="TruthLens API",
    description="Personalized misinformation intervention — PSIS Group B",
    version="0.1.0",
)

# CORS: allow frontend (file:// or localhost:3000) to call backend (localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # permissive for prototype; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------
# FactCheck Pipeline Clients (lazy initialization)
# ---------------------------------------------------------------

_fc_client = None
_gemini_client = None


def _get_fc_client():
    """Get or create Google FactCheck API client."""
    global _fc_client
    if _fc_client is None:
        from app.factcheck.google_client import FactCheckDbClient

        key = os.getenv("FACT_CHECK_API", "")
        _fc_client = FactCheckDbClient(api_key=key)
    return _fc_client


def _get_gemini_client():
    """Get or create Gemini LLM client."""
    global _gemini_client
    if _gemini_client is None:
        from app.factcheck.gemini_client import GeminiClient

        key = os.getenv("GEMINI_API_KEY", "")
        _gemini_client = GeminiClient(api_key=key)
    return _gemini_client


@app.on_event("startup")
def on_startup() -> None:
    """Initialize database tables and seed mock posts on server start."""
    init_db()


# ---------------------------------------------------------------
# 1. GET /api/posts — Return All Posts
# ---------------------------------------------------------------

@app.get("/api/posts")
def get_posts():
    """
    Return all mock social media posts.
    Called by the Feed component on mount.
    """
    conn = get_db()
    posts = conn.execute(
        "SELECT id, author, content, category, is_misinfo FROM posts"
    ).fetchall()
    conn.close()
    return [dict(row) for row in posts]


# ---------------------------------------------------------------
# 2. POST /api/bigfive — Submit BFI-10 Scores
# ---------------------------------------------------------------

@app.post("/api/bigfive")
def submit_bigfive(data: dict):
    """
    Receive BFI-10 personality scores, compute risk score, store in DB.

    Expected body:
      {
        "session_id": "session_123_abc",
        "openness": 7,
        "conscientiousness": 6,
        "extraversion": 5,
        "agreeableness": 8,
        "neuroticism": 4
      }
    Each trait is 2–10 (BFI-10: 2 items × 1–5 Likert scale).
    """
    required = ["session_id", "openness", "conscientiousness",
                "extraversion", "agreeableness", "neuroticism"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")

    bfi = {
        "openness": data["openness"],
        "conscientiousness": data["conscientiousness"],
        "extraversion": data["extraversion"],
        "agreeableness": data["agreeableness"],
        "neuroticism": data["neuroticism"],
    }

    risk_score = calculate_risk_score(bfi)

    conn = get_db()
    conn.execute(
        """INSERT INTO users (session_id, openness, conscientiousness,
           extraversion, agreeableness, neuroticism, risk_score)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
           openness=excluded.openness,
           conscientiousness=excluded.conscientiousness,
           extraversion=excluded.extraversion,
           agreeableness=excluded.agreeableness,
           neuroticism=excluded.neuroticism,
           risk_score=excluded.risk_score""",
        (data["session_id"], bfi["openness"], bfi["conscientiousness"],
         bfi["extraversion"], bfi["agreeableness"], bfi["neuroticism"],
         risk_score),
    )
    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "session_id": data["session_id"],
        "risk_score": risk_score,
    }


# ---------------------------------------------------------------
# 3. POST /api/behavior — Log User Interaction
# ---------------------------------------------------------------

@app.post("/api/behavior")
def log_behavior(data: dict):
    """
    Record a user action on a post.

    Expected body:
      {
        "session_id": "session_123_abc",
        "post_id": 5,
        "action": "view" | "like" | "share" | "dismiss_intervention" | "read_intervention"
      }

    Action semantics:
      - view:               post entered viewport
      - like:               user clicked Like
      - share:              user clicked Share
      - dismiss_intervention: user closed the intervention without reading
      - read_intervention:  user engaged with the intervention content
    """
    session_id = data.get("session_id")
    post_id = data.get("post_id")
    action = data.get("action")

    if not all([session_id, post_id, action]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Convert session_id to user_id
    conn = get_db()
    user = conn.execute(
        "SELECT id FROM users WHERE session_id = ?", (session_id,)
    ).fetchone()

    if not user:
        # Auto-create user if they somehow bypassed BFI-10
        conn.execute(
            """INSERT INTO users (session_id) VALUES (?)
               ON CONFLICT(session_id) DO NOTHING""",
            (session_id,),
        )
        conn.commit()
        user = conn.execute(
            "SELECT id FROM users WHERE session_id = ?", (session_id,)
        ).fetchone()

    conn.execute(
        "INSERT INTO behavior_logs (user_id, post_id, action) VALUES (?, ?, ?)",
        (user["id"], post_id, action),
    )
    conn.commit()
    conn.close()

    return {"status": "ok"}


# ---------------------------------------------------------------
# 4. POST /api/detect — Misinformation Detection
# ---------------------------------------------------------------

@app.post("/api/detect")
def detect_misinformation(
    data: dict,
    live: bool = Query(False, description="Set to true to use the live FactCheck pipeline (Gemini + Google API). Default: use pre-labeled database."),
):
    """
    Check whether a post is misinformation.

    Two modes:
      - live=false (default): looks up the pre-labeled is_misinfo field in DB.
      - live=true: runs the full pipeline:
          1. Gemini extracts claims from the post
          2. Google FactCheck API searches for fact-check records
          3. Gemini aligns results with claims
          4. Rule-based verdict generation
          5. Gemini generates a user-facing explanation
    """
    post_id = data.get("post_id")
    post_content = data.get("post_content", "")

    if not post_id:
        raise HTTPException(status_code=400, detail="Missing post_id")

    # --- Pipeline mode ---
    if live:
        fc_key = os.getenv("FACT_CHECK_API", "")
        gm_key = os.getenv("GEMINI_API_KEY", "")
        if not fc_key or not gm_key:
            raise HTTPException(
                status_code=503,
                detail="Live mode requires FACT_CHECK_API and GEMINI_API_KEY in .env",
            )
        if not post_content:
            raise HTTPException(
                status_code=400,
                detail="Live mode requires post_content in request body",
            )

        try:
            from app.factcheck.models import Post as FPost
            from app.factcheck.pipeline import (
                extract_claims_from_post,
                generate_llm_explanation,
                generate_post_verdict,
            )

            post_obj = FPost(content=post_content)
            claims = extract_claims_from_post(
                _get_gemini_client(), post_obj
            )
            verdict = generate_post_verdict(
                _get_gemini_client(), _get_fc_client(), post_obj, claims
            )

            is_misinfo = any(
                v.label.value in ("FALSE", "MISLEADING")
                for v in verdict.verdicts
            )
            try:
                explanation = generate_llm_explanation(
                    _get_gemini_client(), verdict
                )
            except Exception:
                explanation = "Could not generate explanation."

            return {
                "post_id": post_id,
                "is_misinformation": is_misinfo,
                "fact_check": explanation,
                "source": "factcheck_pipeline",
                "details": [
                    {
                        "claim": v.claim.content,
                        "label": v.label.value,
                        "sources": [
                            {
                                "publisher": s.publisher_name,
                                "rating": s.rating,
                            }
                            for s in v.sources
                        ],
                    }
                    for v in verdict.verdicts
                ],
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Pipeline error: {str(e)}",
            ) from e

    # --- Database mode (original behavior) ---
    conn = get_db()
    post = conn.execute(
        "SELECT is_misinfo, fact_check FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()
    conn.close()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return {
        "post_id": post_id,
        "is_misinformation": bool(post["is_misinfo"]),
        "fact_check": post["fact_check"],
        "source": "pre_labeled_database",
    }


# ---------------------------------------------------------------
# 5. GET /api/intervention/{post_id} — Personalized Intervention
# ---------------------------------------------------------------

@app.get("/api/intervention/{post_id}")
def get_intervention(
    post_id: int,
    session_id: str = Query(..., description="User session ID"),
):
    """
    Return a personalized intervention for a specific post.

    Uses the user's BFI-10 scores and computed risk score to decide:
      - Type 1: Label (simple warning)
      - Type 2: Justification (detailed explanation)
      - Type 3: Interruption (forced pause modal)
    """
    conn = get_db()

    # Get user
    user = conn.execute(
        """SELECT openness, conscientiousness, extraversion,
                  agreeableness, neuroticism, risk_score
           FROM users WHERE session_id = ?""",
        (session_id,),
    ).fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found. Complete BFI-10 first.")

    # Get post
    post = conn.execute(
        "SELECT content, category, fact_check FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()
    conn.close()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    bfi_scores = {
        "openness": user["openness"],
        "conscientiousness": user["conscientiousness"],
        "extraversion": user["extraversion"],
        "agreeableness": user["agreeableness"],
        "neuroticism": user["neuroticism"],
    }

    intervention = select_intervention(
        bfi_scores=bfi_scores,
        risk_score=user["risk_score"],
        post_category=post["category"],
        post_content=post["content"],
        fact_check=post["fact_check"],
    )

    intervention["post_id"] = post_id
    return intervention


# ---------------------------------------------------------------
# 6. GET /api/dashboard/{session_id} — User Dashboard
# ---------------------------------------------------------------

@app.get("/api/dashboard/{session_id}")
def get_dashboard(session_id: str):
    """
    Aggregate user stats for the Dashboard view.

    Returns:
      - topic_diversity:     post count per category (based on viewed posts)
      - misinformation_exposure: misinfo vs total posts seen
      - intervention_stats:  shown / engaged / engagement_rate
      - tips:                personalized media literacy tips
      - risk_score:          user's computed vulnerability score
    """
    conn = get_db()

    # Get user
    user = conn.execute(
        """SELECT id, openness, conscientiousness, extraversion,
                  agreeableness, neuroticism, risk_score
           FROM users WHERE session_id = ?""",
        (session_id,),
    ).fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    user_id = user["id"]

    # --- Topic Diversity: count posts viewed, grouped by category ---
    topic_rows = conn.execute(
        """SELECT p.category, COUNT(*) as cnt
           FROM behavior_logs bl
           JOIN posts p ON bl.post_id = p.id
           WHERE bl.user_id = ? AND bl.action = 'view'
           GROUP BY p.category""",
        (user_id,),
    ).fetchall()
    topic_diversity = {row["category"]: row["cnt"] for row in topic_rows}

    # --- Misinformation Exposure ---
    misinfo_count = conn.execute(
        """SELECT COUNT(DISTINCT bl.post_id) as cnt
           FROM behavior_logs bl
           JOIN posts p ON bl.post_id = p.id
           WHERE bl.user_id = ? AND bl.action = 'view' AND p.is_misinfo = 1""",
        (user_id,),
    ).fetchone()["cnt"]

    total_count = conn.execute(
        "SELECT COUNT(DISTINCT post_id) as cnt FROM behavior_logs WHERE user_id = ? AND action = 'view'",
        (user_id,),
    ).fetchone()["cnt"]

    misinfo_ratio = misinfo_count / total_count if total_count > 0 else 0.0

    # --- Intervention Stats ---
    shown = conn.execute(
        "SELECT COUNT(*) as cnt FROM behavior_logs WHERE user_id = ? AND action = 'view'",
        (user_id,),
    ).fetchone()["cnt"]

    engaged = conn.execute(
        "SELECT COUNT(*) as cnt FROM behavior_logs WHERE user_id = ? AND action = 'read_intervention'",
        (user_id,),
    ).fetchone()["cnt"]

    # Engagement = read_intervention count; shown = number of views on misinfo posts
    # More accurate: count interventions shown via dismiss + read
    interventions_shown = conn.execute(
        """SELECT COUNT(*) as cnt FROM behavior_logs
           WHERE user_id = ? AND action IN ('dismiss_intervention', 'read_intervention')""",
        (user_id,),
    ).fetchone()["cnt"]
    interventions_engaged = engaged
    engagement_rate = (
        interventions_engaged / interventions_shown
        if interventions_shown > 0
        else 0.0
    )

    conn.close()

    # --- Tips ---
    bfi_scores = {
        "openness": user["openness"] or 5,
        "conscientiousness": user["conscientiousness"] or 5,
        "extraversion": user["extraversion"] or 5,
        "agreeableness": user["agreeableness"] or 5,
        "neuroticism": user["neuroticism"] or 5,
    }
    tips = generate_tips(bfi_scores)

    return {
        "topic_diversity": topic_diversity,
        "misinformation_exposure": {
            "misinfo_posts_seen": misinfo_count,
            "total_posts_seen": total_count,
            "misinfo_ratio": round(misinfo_ratio, 3),
        },
        "intervention_stats": {
            "interventions_shown": interventions_shown,
            "interventions_engaged": interventions_engaged,
            "engagement_rate": round(engagement_rate, 3),
        },
        "tips": tips,
        "risk_score": user["risk_score"] or 0.0,
    }
