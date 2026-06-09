"""File containing all the data classes."""

from dataclasses import dataclass

from pydantic import BaseModel, Field


@dataclass
class Post:
    """Data class representing X posts."""

    content: str


@dataclass
class Claim:
    """Data class representing extracted claims."""

    text: str


class Source(BaseModel):
    """Data class representing a source within a fact check."""

    publisher_name: str = Field(description="The name of the publisher")
    publisher_site: str = Field(description="The site of the source publisher")
    url: str = Field(description="The url of the source")
    title: str = Field(description="The title of the source")
    rating: str = Field(description="Whether the claim is true or false")


class FactCheck(BaseModel):
    """Data class representing the results of the fact check api."""

    claim_text: str = Field(description="The claim itself")
    sources: list[Source] = Field(description="The source for/against a claim")
    claim_fact_check_date: str = Field(
        description="When the claim was fact checked"
    )


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
