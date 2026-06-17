"""
main.py — XCheck FastAPI Server

Provides API endpoints consumed by the browser extension, and serves
the mockup website as static files. One server, one port.

Endpoints:
  1. POST /api/bigfive               — Submit BFI-10 scores, compute risk
  2. POST /api/behavior              — Log a user interaction
  3. POST /api/detect                — Run factcheck pipeline on post content
  4. POST /api/intervention          — Get personalized intervention
  5. GET  /api/dashboard/{session_id} — Aggregated stats + tips
  6. GET  /                          — Mockup website (served as static files)

Start with:
    cd 2_backend
    uv run uvicorn main:app --reload --port 8000

Then:
    http://localhost:8000/        → mockup website
    http://localhost:8000/docs    → interactive API docs
    http://localhost:8000/api/*   → API endpoints
"""

from __future__ import annotations

import os
import pathlib

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import get_db, init_db
from app.intervention import (
    calculate_risk_score,
    generate_tips,
    select_intervention,
)

load_dotenv()

# ---------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------

app = FastAPI(
    title="XCheck API",
    description="Personalized misinformation intervention — PSIS Group B",
    version="0.2.0",
)

# CORS: extension content scripts and mockup pages need cross-origin access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    """Initialize database tables on server start."""
    init_db()


# ---------------------------------------------------------------
# 1. POST /api/bigfive — Submit BFI-10 Scores
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
    required = [
        "session_id", "openness", "conscientiousness",
        "extraversion", "agreeableness", "neuroticism",
    ]
    for field in required:
        if field not in data:
            raise HTTPException(
                status_code=400, detail=f"Missing field: {field}"
            )

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
# 2. POST /api/behavior — Log User Interaction
# ---------------------------------------------------------------

@app.post("/api/behavior")
def log_behavior(data: dict):
    """
    Record a user action on a post.

    Expected body:
      {
        "session_id": "session_123_abc",
        "post_identifier": "mockup_post_5",  // post id from mockup JSON OR hash of post content
        "action": "view" | "like" | "share" | "dismiss_intervention" | "read_intervention",
        "dwell_time_ms": 4200,    // optional
        "scroll_speed": 350.5     // optional, pixels/sec
      }
    """
    session_id = data.get("session_id")
    post_identifier = data.get("post_identifier")
    action = data.get("action")

    if not all([session_id, post_identifier, action]):
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: session_id, post_identifier, action",
        )

    conn = get_db()

    # Find or auto-create user
    user = conn.execute(
        "SELECT id FROM users WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not user:
        conn.execute(
            "INSERT INTO users (session_id) VALUES (?) "
            "ON CONFLICT(session_id) DO NOTHING",
            (session_id,),
        )
        conn.commit()
        user = conn.execute(
            "SELECT id FROM users WHERE session_id = ?", (session_id,)
        ).fetchone()

    conn.execute(
        """INSERT INTO behavior_logs
           (user_id, post_identifier, action, dwell_time_ms, scroll_speed)
           VALUES (?, ?, ?, ?, ?)""",
        (
            user["id"],
            str(post_identifier),
            action,
            data.get("dwell_time_ms"),
            data.get("scroll_speed"),
        ),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ---------------------------------------------------------------
# 3. POST /api/detect — Misinformation Detection (FactCheck Pipeline)
# ---------------------------------------------------------------

@app.post("/api/detect")
def detect_misinformation(data: dict):
    """
    Run the factcheck pipeline on a post.

    Expected body:
      { "post_content": "...the text of a post..." }

    Pipeline steps (see src/app/factcheck/pipeline.py):
      1. Gemini extracts independent claims from the post
      2. Google FactCheck API searches for fact-check records per claim
      3. Gemini aligns each result with the claim (CONTRADICTED/MISLEADING/UNVERIFIED)
      4. Rule engine produces a verdict label per claim
      5. Gemini writes a user-facing explanation

    Returns:
      {
        "is_misinformation": bool,
        "fact_check": str,            // human-readable explanation
        "details": [
          {"claim": "...", "label": "FALSE", "sources": [...]}
        ]
      }
    """
    post_content = data.get("post_content", "").strip()
    if not post_content:
        raise HTTPException(
            status_code=400, detail="Missing post_content"
        )

    fc_key = os.getenv("FACT_CHECK_API", "")
    gm_key = os.getenv("GEMINI_API_KEY", "")
    if not fc_key or not gm_key:
        raise HTTPException(
            status_code=503,
            detail="FACT_CHECK_API and GEMINI_API_KEY must be set in .env",
        )

    try:
        from app.factcheck.models import Post as FPost
        from app.factcheck.pipeline import (
            extract_claims_from_post,
            generate_llm_explanation,
            generate_post_verdict,
        )

        post_obj = FPost(content=post_content)
        claims = extract_claims_from_post(_get_gemini_client(), post_obj)
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
            "is_misinformation": is_misinfo,
            "fact_check": explanation,
            "details": [
                {
                    "claim": v.claim.content,
                    "label": v.label.value,
                    "sources": [
                        {
                            "publisher": s.publisher_name,
                            "rating": s.rating,
                            "url": s.url,
                        }
                        for s in v.sources
                    ],
                }
                for v in verdict.verdicts
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Pipeline error: {str(e)}"
        ) from e


# ---------------------------------------------------------------
# 4. POST /api/intervention — Personalized Intervention
# ---------------------------------------------------------------

@app.post("/api/intervention")
def get_intervention(data: dict):
    """
    Return a personalized intervention for a flagged post.

    Expected body:
      {
        "session_id": "session_123_abc",
        "post_content": "...post text...",
        "category": "health" | "politics" | "tech" | "science",
        "fact_check": "...explanation from /api/detect..."
      }

    Uses BFI-10 scores + risk_score to choose:
      - Type 1 Label:         simple warning
      - Type 2 Justification: detailed explanation
      - Type 3 Interruption:  forced pause modal
    """
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    conn = get_db()
    user = conn.execute(
        """SELECT openness, conscientiousness, extraversion,
                  agreeableness, neuroticism, risk_score
           FROM users WHERE session_id = ?""",
        (session_id,),
    ).fetchone()
    conn.close()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found. Complete BFI-10 first.",
        )

    bfi_scores = {
        "openness": user["openness"],
        "conscientiousness": user["conscientiousness"],
        "extraversion": user["extraversion"],
        "agreeableness": user["agreeableness"],
        "neuroticism": user["neuroticism"],
    }

    return select_intervention(
        bfi_scores=bfi_scores,
        risk_score=user["risk_score"],
        post_category=data.get("category", "general"),
        post_content=data.get("post_content", ""),
        fact_check=data.get("fact_check", ""),
    )


# ---------------------------------------------------------------
# 5. GET /api/dashboard/{session_id} — User Dashboard
# ---------------------------------------------------------------

@app.get("/api/dashboard/{session_id}")
def get_dashboard(session_id: str):
    """
    Aggregate user stats for the Dashboard view.

    Note: topic_diversity is no longer computed here because posts are
    not stored in the backend. The extension can compute it locally from
    its own behavior log if needed, or we can re-add category tracking
    later by extending behavior_logs.

    Returns:
      - misinformation_exposure: misinfo vs total posts seen
      - intervention_stats:      shown / engaged / engagement_rate
      - tips:                    personalized media literacy tips
      - risk_score:              user's computed vulnerability score
    """
    conn = get_db()
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

    total_views = conn.execute(
        "SELECT COUNT(DISTINCT post_identifier) as cnt FROM behavior_logs "
        "WHERE user_id = ? AND action = 'view'",
        (user_id,),
    ).fetchone()["cnt"]

    interventions_shown = conn.execute(
        """SELECT COUNT(*) as cnt FROM behavior_logs
           WHERE user_id = ? AND action IN ('dismiss_intervention', 'read_intervention')""",
        (user_id,),
    ).fetchone()["cnt"]

    interventions_engaged = conn.execute(
        "SELECT COUNT(*) as cnt FROM behavior_logs "
        "WHERE user_id = ? AND action = 'read_intervention'",
        (user_id,),
    ).fetchone()["cnt"]

    conn.close()

    engagement_rate = (
        interventions_engaged / interventions_shown
        if interventions_shown > 0 else 0.0
    )

    bfi_scores = {
        "openness": user["openness"] or 5,
        "conscientiousness": user["conscientiousness"] or 5,
        "extraversion": user["extraversion"] or 5,
        "agreeableness": user["agreeableness"] or 5,
        "neuroticism": user["neuroticism"] or 5,
    }
    tips = generate_tips(bfi_scores)

    return {
        "total_posts_viewed": total_views,
        "intervention_stats": {
            "interventions_shown": interventions_shown,
            "interventions_engaged": interventions_engaged,
            "engagement_rate": round(engagement_rate, 3),
        },
        "tips": tips,
        "risk_score": user["risk_score"] or 0.0,
    }


# ---------------------------------------------------------------
# 6. Static Files — Serve Mockup Website at /
# ---------------------------------------------------------------
# Must be mounted AFTER all API routes are defined.
# Path resolves to <repo>/3_frontend/mockup-website regardless of how
# uvicorn is launched, as long as cwd is 2_backend/.

_MOCKUP_DIR = (
    pathlib.Path(__file__).parent.parent
    / "3_frontend"
    / "mockup-website"
)
if _MOCKUP_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(_MOCKUP_DIR), html=True),
        name="mockup",
    )
else:
    print(f"[warn] Mockup directory not found at {_MOCKUP_DIR}")
