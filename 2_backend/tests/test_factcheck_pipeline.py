"""
FactCheck pipeline integration test.

Usage (run from the 2_backend directory):
    cd <repo>/2_backend
    uv run python tests/test_factcheck_pipeline.py

Prerequisites:
    1. Run `uv sync` to install dependencies.
    2. Create a .env file in 2_backend/ with:

        FACT_CHECK_API = "your-google-factcheck-api-key"
        GEMINI_API_KEY = "your-gemini-api-key"

    - FACT_CHECK_API: Google Cloud Console -> Enable "Fact Check Tools API" -> Create API Key
    - GEMINI_API_KEY: https://aistudio.google.com/ -> Get API Key (free, 1500 req/day)

Test steps:
    Step 0 - Load .env and validate API keys
    Step 1 - Google FactCheck API connectivity
    Step 2 - Gemini API connectivity
    Step 3 - Claim extraction (Gemini splits a post into individual claims)
    Step 4 - Full pipeline (extract -> search -> align -> verdict -> explain)
"""

from __future__ import annotations

import os
import pathlib
import sys

# Resolve project root: this file lives at 2_backend/tests/, so parent.parent = 2_backend/
_PROJECT = str(pathlib.Path(__file__).parent.parent)
sys.path.insert(0, _PROJECT)
sys.path.insert(0, os.path.join(_PROJECT, "src"))

from dotenv import load_dotenv

load_dotenv(os.path.join(_PROJECT, ".env"))

FACT_CHECK_KEY = os.getenv("FACT_CHECK_API", "").strip()
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()


def banner(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def ok(msg: str) -> None:
    print(f"  ✅ {msg}")


def fail(msg: str) -> None:
    print(f"  ❌ {msg}")


def info(msg: str) -> None:
    print(f"  ℹ️  {msg}")


# ── Step 0: Validate API keys ────────────────────────────────────

banner("Step 0 — Configuration check")

if not FACT_CHECK_KEY:
    fail("FACT_CHECK_API is not set. Add it to 2_backend/.env")
    info('Format: FACT_CHECK_API = "AIzaSy..."')
    sys.exit(1)
ok(f"FACT_CHECK_API loaded ({FACT_CHECK_KEY[:12]}...{FACT_CHECK_KEY[-4:]})")

if not GEMINI_KEY:
    fail("GEMINI_API_KEY is not set. Add it to 2_backend/.env")
    info('Format: GEMINI_API_KEY = "AIza..."')
    info("Get one at: https://aistudio.google.com/ -> Get API Key")
    sys.exit(1)
ok(f"GEMINI_API_KEY loaded ({GEMINI_KEY[:12]}...{GEMINI_KEY[-4:]})")

# ── Step 1: Google FactCheck API connectivity ────────────────────

banner("Step 1 — Google FactCheck API connectivity")

from app.factcheck.google_client import FactCheckDbClient

gc = FactCheckDbClient(api_key=FACT_CHECK_KEY)

# Use globally well-documented claims that are guaranteed to have fact-check records.
test_claims = [
    "5G causes cancer",
    "vaccines contain microchips",
    "climate change is a hoax",
]

for claim_text in test_claims:
    try:
        results = gc.get_fact_checks(claim_text)
        if results:
            ok(f'"{claim_text}" -> {len(results)} fact-check record(s) found')
            for r in results[:2]:
                print(f"     📰 {r.source.publisher_name}")
                print(f"        Rating: {r.source.rating}")
                print(f"        Title:  {r.source.article_title[:80]}...")
        else:
            info(f'"{claim_text}" -> No results (niche claims may not be indexed)')
    except Exception as e:
        fail(f'"{claim_text}" -> API call failed: {e}')

# ── Step 2: Gemini API connectivity ─────────────────────────────

banner("Step 2 — Gemini API connectivity")

from app.factcheck.gemini_client import GeminiClient

gemini = GeminiClient(api_key=GEMINI_KEY)

try:
    reply = gemini.ask("In one sentence, explain what fact-checking is.")
    ok(f"Gemini reachable. Response: {reply[:120]}...")
except Exception as e:
    fail(f"Gemini call failed: {e}")
    sys.exit(1)

# ── Step 3: Claim extraction ─────────────────────────────────────

banner("Step 3 — Claim extraction")

from app.factcheck.models import Post
from app.factcheck.prompts import create_claim_extraction_prompt
from app.factcheck.parser import parse_claims

test_post = Post(
    content=(
        "Doctors are hiding the truth: drinking celery juice "
        "every morning cures cancer naturally without chemotherapy. "
        "Big Pharma doesn't want you to know this!"
    )
)

info(f"Test post: {test_post.content}")

try:
    prompt = create_claim_extraction_prompt(test_post.content)
    raw_response = gemini.ask(prompt)
    claims = parse_claims(raw_response)

    ok(f"{len(claims)} claim(s) extracted:")
    for i, c in enumerate(claims, 1):
        print(f"     Claim {i}: {c.content}")
except Exception as e:
    fail(f"Claim extraction failed: {e}")
    import traceback
    traceback.print_exc()

# ── Step 4: Full pipeline ────────────────────────────────────────

banner("Step 4 — Full pipeline (extract -> search -> align -> verdict -> explain)")

from app.factcheck.pipeline import (
    extract_claims_from_post,
    get_fact_checks_for_single_claim,
    align_fact_checks_with_claim,
    generate_verdict,
    generate_post_verdict,
    generate_llm_explanation,
)

test_post_2 = Post(
    content=(
        "The WHO admitted that COVID-19 was created in a lab "
        "as a bioweapon. This was leaked in internal documents."
    )
)

print(f"  Test post: {test_post_2.content}\n")

# Step A: Extract claims
info("Step A: Extracting claims with Gemini...")
claims = extract_claims_from_post(client=gemini, post=test_post_2)
print(f"  {len(claims)} claim(s) extracted:")
for c in claims:
    print(f"    📝 {c.content}")

# Step B: Query Google FactCheck API for each claim
all_verdicts = []
for claim in claims:
    info(f"\nStep B: Querying Google API for: \"{claim.content[:60]}...\"")
    fact_checks = get_fact_checks_for_single_claim(gc, claim)
    print(f"  {len(fact_checks)} fact-check record(s) found")

    if not fact_checks:
        from app.factcheck.models import Verdict, VerdictLabel
        all_verdicts.append(
            Verdict(claim=claim, label=VerdictLabel.UNVERIFIED, sources=[])
        )
        info("  No records found -> marked UNVERIFIED")
        continue

    for fc in fact_checks:
        print(f"    📰 {fc.source.publisher_name}: {fc.source.rating}")

    # Step C: Gemini alignment — are these fact-checks relevant to the claim?
    info("Step C: Gemini alignment check...")
    try:
        alignment = align_fact_checks_with_claim(gemini, claim, fact_checks)
        for a in alignment.alignments:
            print(f"    {a.source.publisher_name}: {a.verdict}")

        # Step D: Rule-based verdict
        verdict = generate_verdict(claim, alignment)
        all_verdicts.append(verdict)
        print(f"  Verdict: {verdict.label.value}")
    except Exception as e:
        info(f"  Alignment failed: {e} — skipping claim")

# Step E: Aggregate results
banner("Final verdicts")
from app.factcheck.models import PostVerdict

final = PostVerdict(post=test_post_2, verdicts=all_verdicts)

print(f"  {len(final.verdicts)} claim verdict(s):")
emoji = {"FALSE": "🔴", "MISLEADING": "🟡", "DISPUTED": "🟠", "UNVERIFIED": "⚪"}
for v in final.verdicts:
    print(f"    {emoji.get(v.label.value, '❓')} {v.label.value}: {v.claim.content[:70]}...")

# Step F: Generate user-facing explanation (only if at least one non-UNVERIFIED verdict)
if any(v.label.value != "UNVERIFIED" for v in final.verdicts):
    info("\nStep F: Generating user explanation with Gemini...")
    try:
        explanation = generate_llm_explanation(gemini, final)
        print(f"  📄 {explanation}")
    except Exception as e:
        fail(f"Explanation generation failed: {e}")
else:
    info("\nAll claims UNVERIFIED — skipping explanation (no actionable verdict)")

# ── Done ─────────────────────────────────────────────────────────

banner("Test complete")

print("""
  If all steps passed:
    ✅ Google FactCheck API can search and return fact-check records
    ✅ Gemini can extract claims, judge alignment, and generate explanations
    ✅ The full pipeline runs end-to-end
""")
