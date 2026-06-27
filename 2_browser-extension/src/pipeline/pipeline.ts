import { GeminiClient } from "./geminiClient";
import { FactCheckDbClient } from "./googleClient";
import {
  AlignmentResult,
  Claim,
  FactCheck,
  Post,
  PostVerdict,
  UserResponse,
  Verdict,
  VerdictLabel,
} from "./types";
import { parseAlignmentResult, parseClaims } from "./parser";
import {
  createAlignmentPrompt,
  createClaimExtractionPrompt,
  createUserResponsePrompt,
} from "./prompts";

export async function extractClaimsFromPost(
  client: GeminiClient,
  post: Post,
): Promise<Claim[]> {
  const prompt = createClaimExtractionPrompt(post.content);
  const result = await client.ask(prompt);
  return parseClaims(result);
}

export async function getFactChecksForSingleClaim(
  client: FactCheckDbClient,
  claim: Claim,
): Promise<FactCheck[]> {
  return client.getFactChecks(claim.content);
}

export async function alignFactChecksWithClaim(
  client: GeminiClient,
  claim: Claim,
  factChecks: FactCheck[],
): Promise<AlignmentResult> {
  if (!factChecks.length) {
    throw new Error("No fact checks provided.");
  }
  const prompt = createAlignmentPrompt(claim, factChecks);
  const response = await client.ask(prompt);
  return parseAlignmentResult(response, claim, factChecks);
}

export function generateVerdict(
  claim: Claim,
  alignmentResult: AlignmentResult,
): Verdict {
  const relevantAlignments = alignmentResult.alignments.filter(
    (a) => a && a.verdict != null,
  );
  const relevantVerdicts = new Set(relevantAlignments.map((a) => a.verdict));
  const sources = relevantAlignments.map((a) => a.source);

  let label: VerdictLabel;
  if (!relevantVerdicts.size) {
    label = VerdictLabel.UNVERIFIED;
  } else if (
    relevantVerdicts.size === 1 &&
    relevantVerdicts.has("CONTRADICTED")
  ) {
    label = VerdictLabel.FALSE;
  } else if (
    relevantVerdicts.size === 1 &&
    relevantVerdicts.has("MISLEADING")
  ) {
    label = VerdictLabel.MISLEADING;
  } else if (relevantVerdicts.has("CONTRADICTED")) {
    label = VerdictLabel.DISPUTED;
  } else {
    label = VerdictLabel.UNVERIFIED;
  }

  return { claim, label, sources };
}

export async function generatePostVerdict(
  geminiClient: GeminiClient,
  factCheckClient: FactCheckDbClient,
  post: Post,
  claims: Claim[],
): Promise<PostVerdict> {
  const verdicts: Verdict[] = [];

  for (const claim of claims) {
    const factChecks = await getFactChecksForSingleClaim(
      factCheckClient,
      claim,
    );
    if (!factChecks.length) continue;

    const alignmentResult = await alignFactChecksWithClaim(
      geminiClient,
      claim,
      factChecks,
    );
    verdicts.push(generateVerdict(claim, alignmentResult));
  }

  return { post, verdicts };
}

export async function generateLlmExplanation(
  client: GeminiClient,
  postVerdict: PostVerdict,
): Promise<string> {
  const prompt = createUserResponsePrompt(postVerdict);
  return client.ask(prompt);
}

/**
 * Full fact-check entry point: extract claims → verify against fact databases → derive verdicts.
 * Callers inject the two API clients (BYOK keys, §6). A plain-language explanation is available
 * separately via generateLlmExplanation; it is intentionally NOT produced here, to avoid one extra
 * Gemini call per post (the intervention wording is generated downstream instead).
 */
export async function factCheck(
  geminiClient: GeminiClient,
  factCheckClient: FactCheckDbClient,
  post: Post,
): Promise<UserResponse> {
  const claims = await extractClaimsFromPost(geminiClient, post);
  const postVerdict = await generatePostVerdict(
    geminiClient,
    factCheckClient,
    post,
    claims,
  );
  return { verdicts: [postVerdict] };
}
