"""File containing all the fact checking related functions."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.factcheck.google_client import FactCheckDbClient
from app.factcheck.parser import parse_claims
from app.factcheck.prompts import create_claim_extraction_prompt

if TYPE_CHECKING:
    from app.factcheck.claude_client import ClaudeClient
    from app.factcheck.models import Claim, FactCheck, Post


def extract_claims_from_post(client: ClaudeClient, post: Post) -> list[Claim]:
    """Receives X post and extracts the claims of each post.

    Requires LLM.
    """
    content = post.content
    prompt = create_claim_extraction_prompt(content)
    results = client.ask(prompt)
    return parse_claims(results)


def get_fact_checks(
    client: FactCheckDbClient, claims: list[Claim]
) -> list[list[FactCheck]]:
    """Find fact checks from the google api or from the internet."""
    fact_checks = [client.get_fact_checks(claim.content) for claim in claims]
    return fact_checks


def align_fact_checks_with_claim():
    """Align the fact check with the claims.

    Given the claim and the retrieved fact checks. Ask an LLM if the fact
    checks align for this specific claim.
    """
    pass


def generate_verdict():
    """Given all the gathered information, produce a verdict.

    Rule based. The rules should be applied to align_fact_checks_with_claim
    """
    pass


def generate_llm_explanation():
    """Generate the final response for the user."""
    pass
