"""File containing all the fact checking related functions."""

from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING

from app.factcheck.claude_client import ClaudeClient
from app.factcheck.google_client import FactCheckDbClient
from app.factcheck.models import AlignmentResult, Claim, Post
from app.factcheck.parser import parse_alignment_result
from app.factcheck.prompts import (
    create_alignment_prompt,
    create_claim_extraction_prompt,
)

if TYPE_CHECKING:
    from app.factcheck.models import FactCheck


class Verdict(StrEnum):
    """Enums for the final rule based verdict."""

    FALSE = "FALSE"
    MISLEADING = "MISLEADING"
    DISPUTED = "DISPUTED"
    UNVERIFIED = "UNVERIFIED"


fact_check_client = FactCheckDbClient(
    api_key="AIzaSyAVWYPG2QccEP6LTeTFM6Vbp3bAY1K17Tg"
)
claude_client = ClaudeClient(api_key="")


def extract_claims_from_post(client: ClaudeClient, post: Post) -> list[Claim]:
    """Receives X post and extracts the claims of each post.

    Requires LLM.
    """
    content = post.content
    prompt = create_claim_extraction_prompt(content)
    # results = client.ask(prompt)
    # return parse_claims(results)
    return [
        Claim(content="Scientists confirmed 5G cancer"),
        Claim(content="Bill Gates COVID vaccines microchips"),
        Claim(content="Earth's population 10 billion 2030"),
    ]


def get_fact_checks_for_single_claim(
    client: FactCheckDbClient, claim: Claim
) -> list[FactCheck]:
    """Find fact checks from the google api or from the internet."""
    fact_checks = client.get_fact_checks(claim.content)
    return fact_checks


def align_fact_checks_with_claim(
    client: ClaudeClient,
    claim: Claim,
    fact_checks: list[FactCheck],
) -> AlignmentResult:
    """Ask the LLM if the fact checks are relevant and align with the claim."""
    if not fact_checks:
        raise ValueError("No fact checks provided.")
    prompt = create_alignment_prompt(claim, fact_checks)
    response = client.ask(prompt)
    return parse_alignment_result(response, claim, fact_checks)


def generate_verdict(alignment_result: AlignmentResult) -> Verdict:
    """Given all the gathered information, produce a verdict."""
    relevant_verdicts = {
        alignment.verdict
        for alignment in alignment_result.alignments
        if alignment and alignment.verdict is not None
    }

    if not relevant_verdicts:
        return Verdict.UNVERIFIED

    if relevant_verdicts == {"CONTRADICTED"}:
        return Verdict.FALSE
    if relevant_verdicts == {"MISLEADING"}:
        return Verdict.MISLEADING
    if "CONTRADICTED" in relevant_verdicts:
        return Verdict.DISPUTED

    return Verdict.UNVERIFIED


def generate_llm_explanation():
    """Generate the final response for the user."""
    pass


if __name__ == "__main__":
    example_post = Post(
        content="Scientists have confirmed that 5G towers cause cancer. \
        Bill Gates admitted that COVID vaccines contain microchips. \
            The Earth's population will reach 10 billion by 2030."
    )
    claims = extract_claims_from_post(client=claude_client, post=example_post)
    claim = Claim(content="Area51 contains Aliens")
    fact_checks = get_fact_checks_for_single_claim(fact_check_client, claim)
    alignments = align_fact_checks_with_claim(
        claude_client, claim, fact_checks
    )
    generate_verdict(alignments)
