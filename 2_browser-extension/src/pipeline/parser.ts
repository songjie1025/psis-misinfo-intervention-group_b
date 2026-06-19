import { AlignmentResult, Claim, FactCheck, SourceAlignment } from "./types";

export function parseClaims(response: string): Claim[] {
  let claimsStr = response.trim();

  if (claimsStr.includes("[") && claimsStr.includes("]")) {
    const start = claimsStr.indexOf("[");
    const end = claimsStr.indexOf("]");
    claimsStr = claimsStr.slice(start + 1, end);
  }

  return claimsStr.split("|").map((claim) => ({ content: claim.trim() }));
}

export function parseAlignmentResult(
  response: string,
  claim: Claim,
  factChecks: FactCheck[],
): AlignmentResult {
  const start = response.indexOf("[");
  const end = response.lastIndexOf("]") + 1;
  const verdicts = JSON.parse(response.slice(start, end)) as {
    id: number;
    verdict: "CONTRADICTED" | "MISLEADING" | "UNVERIFIED";
    relevant: boolean;
  }[];

  const alignments: SourceAlignment[] = verdicts
    .filter((v) => v.id < factChecks.length && v.relevant)
    .map((v) => ({
      source: factChecks[v.id].source,
      verdict: v.verdict,
    }));

  return { claim: claim.content, alignments };
}
