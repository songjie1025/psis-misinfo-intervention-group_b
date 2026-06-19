import { Claim, FactCheck, PostVerdict } from "./types";

export function createClaimExtractionPrompt(content: string): string {
  return `You are given the following X post:
    ${content}

    Do the following:
        1. Extract all the claims that were made
        2. Make sure the claims are not longer than one sentence.
        3. Output all of the claims separated by | and nothing else.
            e.g. [claim_1 | claim_2 | claim_N]
    `;
}

export function createAlignmentPrompt(
  claim: Claim,
  factChecks: FactCheck[],
): string {
  const factChecksStr = factChecks
    .map(
      (fc, i) =>
        `[ID ${i}] Claim that was disproved: ${fc.claimText} | Evidence title: ${fc.source.articleTitle}`,
    )
    .join("\n");

  return `Given the following claim:
    ${claim.content}

    And the following fact checks (note: each fact check may investigate a
    slightly different but related claim):
        ${factChecksStr}

    For each fact check, first determine if it is relevant to the claim, then
    classify it as one of:
    - CONTRADICTED: the fact check clearly and directly contradicts the claim
    - MISLEADING: the claim is partially true but missing context/misleading
    - UNVERIFIED: the fact check cannot confirm or deny the claim

    Output only a JSON list and nothing else:
    [
        {"id": 0, "relevant": true, "verdict": "CONTRADICTED"},
        {"id": 1, "relevant": true, "verdict": "MISLEADING"},
        {"id": 2, "relevant": false, "verdict": null}
    ]`;
}

export function createUserResponsePrompt(postVerdict: PostVerdict): string {
  const verdictsStr = postVerdict.verdicts
    .map((verdict) => {
      const sourcesStr = verdict.sources
        .map(
          (source) =>
            `[${source.publisherName}]: ${source.articleTitle} (${source.url})`,
        )
        .join("\n");
      return `Claim: ${verdict.claim.content}\nVerdict: ${verdict.label}\nSources:\n${sourcesStr}`;
    })
    .join("\n\n");

  return `You are a fact-checking assistant. Given the following post and
    the fact check results for each claim, generate a clear and concise
    response for the user.

    Original post:
        ${postVerdict.post.content}

    Fact check results:
        ${verdictsStr}

    Write a short, neutral, and informative summary of the fact check results.
    Do not use bullet points. Write in plain prose, 3-4 sentences maximum.`;
}
