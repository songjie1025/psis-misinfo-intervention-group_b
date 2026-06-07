"""Demo file how to access the fact check api."""

from __future__ import annotations

import os

import requests
from dotenv import load_dotenv

load_dotenv()


def send_request_to_fact_check_api(claim: str, api_key: str | None) -> dict:
    """Send a claim to the Google Fact Check API and return the results."""
    url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    params = {
        "query": claim,
        "key": api_key,
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()


results = send_request_to_fact_check_api(
    claim="Covid was created in a lab as a bio weapon",
    api_key=os.getenv("FACT_CHECK_API"),
)

for claim in results.get("claims", []):
    print(claim["text"])
    for review in claim.get("claimReview", []):
        print(" →", review["textualRating"], "-", review["publisher"]["name"])
