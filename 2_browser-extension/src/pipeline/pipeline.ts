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

export function factCheck(post: Post): UserResponse {
  // const claims = await extractClaimsFromPost(geminiClient, post);
  // const postVerdict = await generatePostVerdict(
  //   geminiClient,
  //   factCheckClient,
  //   post,
  //   claims,
  // );
  // const llmExplanation = generateLlmExplanation(geminiClient, postVerdict);

  return {
    factCheckText: "This post was flagged as misinformation",
    verdicts: [
      {
        post: { content: "5G causes cancer. Vaccines contain microchips." },
        verdicts: [
          {
            claim: { content: "5G causes cancer" },
            label: VerdictLabel.FALSE,
            sources: [
              {
                publisherName: "Reuters",
                publisherSite: "reuters.com",
                url: "https://reuters.com/1",
                articleTitle: "Fact check: 5G does not cause cancer",
                rating: "False",
              },
            ],
          },
          {
            claim: { content: "Vaccines contain microchips" },
            label: VerdictLabel.DISPUTED,
            sources: [
              {
                publisherName: "BBC",
                publisherSite: "bbc.com",
                url: "https://bbc.com/1",
                articleTitle: "No, vaccines do not contain microchips",
                rating: "False",
              },
              {
                publisherName: "AP News",
                publisherSite: "apnews.com",
                url: "https://apnews.com/1",
                articleTitle:
                  "Fact check: Vaccine microchip claim is misleading",
                rating: "Misleading",
              },
            ],
          },
        ],
      },
    ],
  };
}
