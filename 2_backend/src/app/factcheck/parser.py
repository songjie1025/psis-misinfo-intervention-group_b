"""Contains parsing functions for handling fact check api response."""

from __future__ import annotations

import json

from app.factcheck.models import (
    AlignmentResult,
    Claim,
    FactCheck,
    SourceAlignment,
)


def parse_claims(response: str) -> list[Claim]:
    """Parse the list of claims from the Claude response."""
    start = response.index("[")
    end = response.index("]")
    claims_str = response[start + 1 : end]
    return [Claim(content=claim.strip()) for claim in claims_str.split("|")]


def parse_alignment_result(
    response: str, claim: Claim, fact_checks: list[FactCheck]
) -> AlignmentResult:
    """Parse the LLM response into an AlignmentResult."""
    start = response.index("[")
    end = response.rindex("]") + 1
    verdicts = json.loads(response[start:end])

    alignments = [
        SourceAlignment(
            source=fact_checks[v["id"]].source,
            verdict=v["verdict"],
        )
        for v in verdicts
        if v["id"] < len(fact_checks) and v["relevant"]
    ]

    return AlignmentResult(claim=claim.content, alignments=alignments)
