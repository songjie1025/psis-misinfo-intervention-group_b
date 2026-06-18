"""File containing all the fact checking related functions."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.factcheck.gemini_client import GeminiClient
from app.factcheck.google_client import FactCheckDbClient
from app.factcheck.models import (
    AlignmentResult,
    Claim,
    Post,
    PostVerdict,
    Verdict,
    VerdictLabel,
)
from app.factcheck.parser import parse_alignment_result, parse_claims
from app.factcheck.prompts import (
    create_alignment_prompt,
    create_claim_extraction_prompt,
    create_user_response_prompt,
)

if TYPE_CHECKING:
    from app.factcheck.models import FactCheck


def extract_claims_from_post(client: GeminiClient, post: Post) -> list[Claim]:
    """Receives X post and extracts the claims of each post."""
    prompt = create_claim_extraction_prompt(post.content)
    results = client.ask(prompt)
    return parse_claims(results)


def get_fact_checks_for_single_claim(
    client: FactCheckDbClient, claim: Claim
) -> list[FactCheck]:
    """Find fact checks from the google api for a single claim."""
    return client.get_fact_checks(claim.content)


def align_fact_checks_with_claim(
    client: GeminiClient,
    claim: Claim,
    fact_checks: list[FactCheck],
) -> AlignmentResult:
    """Ask the LLM if the fact checks are relevant and align with the claim."""
    if not fact_checks:
        raise ValueError("No fact checks provided.")
    prompt = create_alignment_prompt(claim, fact_checks)
    response = client.ask(prompt)
    return parse_alignment_result(response, claim, fact_checks)


def generate_verdict(
    claim: Claim, alignment_result: AlignmentResult
) -> Verdict:
    """Given all the gathered information, produce a verdict for a claim."""
    relevant_alignments = [
        a for a in alignment_result.alignments if a and a.verdict is not None
    ]
    relevant_verdicts = {a.verdict for a in relevant_alignments}
    sources = [a.source for a in relevant_alignments]

    if not relevant_verdicts:
        label = VerdictLabel.UNVERIFIED
    elif relevant_verdicts == {"CONTRADICTED"}:
        label = VerdictLabel.FALSE
    elif relevant_verdicts == {"MISLEADING"}:
        label = VerdictLabel.MISLEADING
    elif "CONTRADICTED" in relevant_verdicts:
        label = VerdictLabel.DISPUTED
    else:
        label = VerdictLabel.UNVERIFIED

    return Verdict(claim=claim, label=label, sources=sources)


def generate_post_verdict(
    gemini_client: GeminiClient,
    fact_check_client: FactCheckDbClient,
    post: Post,
    claims: list[Claim],
) -> PostVerdict:
    """Combine all claim verdicts into a single post verdict."""
    verdicts = []
    for claim in claims:
        fact_checks = get_fact_checks_for_single_claim(
            fact_check_client, claim
        )
        if not fact_checks:
            continue
        alignment_result = align_fact_checks_with_claim(
            gemini_client, claim, fact_checks
        )
        verdict = generate_verdict(claim, alignment_result)
        verdicts.append(verdict)

    return PostVerdict(post=post, verdicts=verdicts)


def generate_llm_explanation(
    client: GeminiClient, post_verdict: PostVerdict
) -> str:
    """Generate the final response for the user."""
    prompt = create_user_response_prompt(post_verdict)
    return client.ask(prompt)


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()

    example_post = Post(
        content="Scientists have confirmed that 5G towers cause cancer. "
        "Bill Gates admitted that COVID vaccines contain microchips. "
        "The Earth's population will reach 10 billion by 2030."
    )

    gemini = GeminiClient(api_key=os.getenv("GEMINI_API_KEY", ""))
    fc = FactCheckDbClient(api_key=os.getenv("FACT_CHECK_API", ""))

    claims = extract_claims_from_post(client=gemini, post=example_post)
    post_verdict = generate_post_verdict(gemini, fc, example_post, claims)
    explanation = generate_llm_explanation(gemini, post_verdict)
    print(explanation)
