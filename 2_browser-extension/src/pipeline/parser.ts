import { AlignmentResult, Claim, FactCheck, SourceAlignment } from "./types";

export function parseClaims(response: string): Claim[] {
  let claimsStr = response.trim();

  if (claimsStr.includes("[") && claimsStr.includes("]")) {
    const start = claimsStr.indexOf("[");
    const end = claimsStr.lastIndexOf("]");
    claimsStr = claimsStr.slice(start + 1, end);
  }

  return claimsStr
    .split("|")
    .map((claim) => ({ content: claim.trim() }))
    .filter((claim) => claim.content.length > 0);
}

export function parseAlignmentResult(
  response: string,
  claim: Claim,
  factChecks: FactCheck[],
): AlignmentResult {
  const start = response.indexOf("[");
  const end = response.lastIndexOf("]") + 1;

  let verdicts: {
    id: number;
    verdict: "CONTRADICTED" | "MISLEADING" | "UNVERIFIED";
    relevant: boolean;
  }[];

  try {
    if (start < 0 || end <= start) throw new Error("no JSON array in response");
    verdicts = JSON.parse(response.slice(start, end));
  } catch {
    // Malformed LLM output → treat as "no usable alignment" instead of crashing.
    return { claim: claim.content, alignments: [] };
  }

  const alignments: SourceAlignment[] = verdicts
    .filter((v) => v.id < factChecks.length && v.relevant)
    .map((v) => ({
      source: factChecks[v.id].source,
      verdict: v.verdict,
    }));

  return { claim: claim.content, alignments };
}
