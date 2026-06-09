"""Contains parsing functions for handling fact check api response."""

from __future__ import annotations

from app.factcheck.models import FactCheck, Source


def extract_fact_checks_from_api_response(response: dict) -> list[FactCheck]:
    """Extract Fact Checks from the Google API response."""
    fact_checks = []

    for claim in response.get("claims", []):
        claim_review = claim.get("claimReview", [])
        sources = [parse_source(source) for source in claim_review]

        fact_checks.append(
            FactCheck(
                claim_text=claim.get("text", ""),
                claim_fact_check_date=claim.get("claimDate", ""),
                sources=sources,
            )
        )

    return fact_checks


def parse_source(source: dict) -> Source:
    """Parse a single source from a claim review."""
    publisher = source.get("publisher", {})
    return Source(
        publisher_name=publisher.get("name", ""),
        publisher_site=publisher.get("site", ""),
        url=source.get("url", ""),
        title=source.get("title", ""),
        rating=source.get("rating", ""),
    )
