"""Contains parsing functions for handling fact check api response."""

from __future__ import annotations

from app.factcheck.models import Claim


def parse_claims(response: str) -> list[Claim]:
    """Parse the list of claims from the Claude response."""
    start = response.index("[")
    end = response.index("]")
    claims_str = response[start + 1 : end]
    return [Claim(content=claim.strip()) for claim in claims_str.split(",")]
