"""File containing all the data classes."""

from dataclasses import dataclass


@dataclass
class Post:
    """Data class representing X posts."""

    content: str


@dataclass
class Claim:
    """Data class representing extracted claims."""

    text: str


@dataclass
class FactCheck:
    """Data class representing the results of the fact check api."""

    claim_reviewed: str
    rating: str
    article_url: str
    publisher: str
    article_text: str


@dataclass
class AlignmentResult:
    """Data class representing the alignment result."""

    claim: str
    fact_check_claim: str
    match_type: str
    confidence: float
    reason: str
    rating: str


@dataclass
class ClaimVerdict:
    """Data class representing the verdict for a claim."""

    claim: Claim

    label: str
    confidence: float

    supporting_fact_checks: list[FactCheck]


@dataclass
class FinalExplanation:
    """Data class representing the final explanation, what the user sees."""

    verdict: ClaimVerdict
    explanation: str
