"""Contains the claude client."""

from __future__ import annotations

import requests


class FactCheckDbClient:
    """Client to send requests to the Claude API."""

    API_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    def __init__(self, api_key: str) -> None:
        """Initialize the client."""
        self.api_key = api_key

    def send_request_to_fact_check_api(self, claim: str) -> dict:
        """Send a claim to the Google Fact Check API and return the results."""
        params = {
            "query": claim,
            "key": self.api_key,
        }
        response = requests.get(self.API_URL, params=params)
        response.raise_for_status()
        return response.json()
