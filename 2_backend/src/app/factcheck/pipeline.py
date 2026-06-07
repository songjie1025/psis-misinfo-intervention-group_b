"""File containing all the fact checking related functions."""

from __future__ import annotations


def extract_claims_from_fb_post():
    """Receives X posts and extracts the claims of each post.

    Requires LLM.
    """
    return


def get_fact_checks():
    """Find fact checks from the google api or from the internet."""
    pass


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
