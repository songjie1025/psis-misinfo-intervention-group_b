"""File containing all the data classes."""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field


class Post(BaseModel):
    """Data class representing X posts."""

    content: str = Field(description="The textual content of an X post.")


class Claim(BaseModel):
    """Data class representing extracted claims."""

    content: str = Field(description="The claim")


class Source(BaseModel):
    """Data class representing a source within a fact check."""

    publisher_name: str = Field(description="The name of the publisher")
    publisher_site: str = Field(description="The site of the source publisher")
    url: str = Field(description="The url of the source")
    article_title: str = Field(description="The title of the source")
    rating: str = Field(description="Whether the claim is true or false")


class FactCheck(BaseModel):
    """Data class representing the results of the fact check api."""

    claim_text: str = Field(
        description="The claim that was fact checked by the api"
    )
    source: Source = Field(description="The source against a claim")
    claim_fact_check_date: str = Field(
        description="When the claim was fact checked"
    )


class SourceAlignment(BaseModel):
    """Alignment for a source."""

    source: Source
    verdict: Literal["SUPPORTED", "CONTRADICTED", "UNRELATED"]


class AlignmentResult(BaseModel):
    """Aligns a claim with its sources."""

    claim: str
    alignments: list[SourceAlignment]


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
