"""Contains all the prompting utilities."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.factcheck.models import Claim, FactCheck, PostVerdict


def create_claim_extraction_prompt(content: str) -> str:
    """Create the prompt for extracting all the claims made in an X post."""
    template = """You are given the following X post:
    <CONTENT>

    Do the following:
        1. Extract all the claims that were made
        2. Make sure the claims are not longer than one sentence.
        3. Output all of the claims separated by | and nothing else.
            e.g. [claim_1 | claim_2 | claim_N]
    """
    return template.replace("<CONTENT>", content)


def create_alignment_prompt(claim: Claim, fact_checks: list[FactCheck]) -> str:
    """Create a prompt to check if fact checks align with the claim."""
    fact_checks_str = "\n".join(
        f"[ID {i}] Claim that was disproved: {fc.claim_text} | Evidence title: {fc.source.article_title}"
        for i, fc in enumerate(fact_checks)
    )
    return f"""Given the following claim:
    {claim.content}

    And the following fact checks (note: each fact check may investigate a
    slightly different but related claim):
        {fact_checks_str}

    For each fact check, first determine if it is relevant to the claim, then
    classify it as one of:
    - CONTRADICTED: the fact check clearly and directly contradicts the claim
    - MISLEADING: the claim is partially true but missing context/misleading
    - UNVERIFIED: the fact check cannot confirm or deny the claim

    Output only a JSON list and nothing else:
    [
        {{"id": 0, "relevant": true, "verdict": "CONTRADICTED"}},
        {{"id": 1, "relevant": true, "verdict": "MISLEADING"}},
        {{"id": 2, "relevant": false, "verdict": null}}
    ]"""


def create_user_response_prompt(post_verdict: PostVerdict) -> str:
    """Create a prompt to generate a user explanation of the post verdict."""
    verdicts_str = "\n\n".join(
        f"Claim: {verdict.claim.content}\n"
        f"Verdict: {verdict.label}\n"
        f"Sources:\n"
        + "\n".join(
            f"[{source.publisher_name}]: {source.article_title} ({source.url})"
            for source in verdict.sources
        )
        for verdict in post_verdict.verdicts
    )
    return f"""You are a fact-checking assistant. Given the following post and
    the fact check results for each claim, generate a clear and concise
    response for the user.

    Original post:
        {post_verdict.post.content}

    Fact check results:
        {verdicts_str}

    Write a short, neutral, and informative summary of the fact check results.
    Do not use bullet points. Write in plain prose, 3-4 sentences maximum."""
