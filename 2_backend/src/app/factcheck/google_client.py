"""Contains the google fact check client."""

from __future__ import annotations

import requests

from app.factcheck.models import FactCheck, Source


class FactCheckDbClient:
    """Client to send requests to the Google Fact Check API."""

    API_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    def __init__(self, api_key: str) -> None:
        """Initialize the client."""
        self.api_key = api_key

    def get_fact_checks(self, claim: str) -> list[FactCheck]:
        """Return fact checks for a given claim."""
        response = self._send_request_to_fact_check_api(claim)
        return self._extract_fact_checks_from_api_response(response)

    def _send_request_to_fact_check_api(self, claim: str) -> dict:
        """Send a claim to the Google Fact Check API and return the results."""
        params = {
            "query": claim,
            "key": self.api_key,
        }
        response = requests.get(self.API_URL, params=params)
        response.raise_for_status()
        return response.json()

    def _extract_fact_checks_from_api_response(
        self, response: dict
    ) -> list[FactCheck]:
        """Extract Fact Checks from the Google API response."""
        fact_checks = []

        for claim in response.get("claims", []):
            claim_review = claim.get("claimReview", [])
            if not claim_review:
                continue

            fact_checks.append(
                FactCheck(
                    claim_text=claim.get("text", ""),
                    claim_fact_check_date=claim.get("claimDate", ""),
                    source=self._parse_source(claim_review[0]),
                )
            )

        return fact_checks

    def _parse_source(self, source: dict) -> Source:
        """Parse a single source from a claim review."""
        publisher = source.get("publisher", {})
        return Source(
            publisher_name=publisher.get("name", ""),
            publisher_site=publisher.get("site", ""),
            url=source.get("url", ""),
            article_title=source.get("title", ""),
            rating=source.get("textualRating", ""),
        )
