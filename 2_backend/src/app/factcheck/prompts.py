"""Contains all the prompting utilities."""

from __future__ import annotations


def create_claim_extraction_prompt(content: str) -> str:
    """Create the prompt for extracting all the claims made in an X post."""
    template = """You are given the following X post:
    <CONTENT>

    Do the following:
        1. Extract all the claims that were made
        2. Make sure the claims are not longer than one sentence.
        3. Output all of the claims in one final list
            e. g. [claim_1, claim_2, ..., claim_N]
    """
    return template.replace("<CONTENT>", content)


def create_align_fact_checks_prompt():
    pass


def create_user_response_prompt():
    pass
