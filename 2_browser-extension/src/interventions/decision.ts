// Assemble the InterventionDecision hand-off object (pure logic).
import { PostVerdict, Verdict, VerdictLabel } from "../pipeline/types";
import { RiskBand } from "../scoring/types";
import { InterventionDecision, InterventionSource, Tier } from "./types";

// Which verdict "wins" when a post has multiple claims.
const SEVERITY: Record<VerdictLabel, number> = {
  [VerdictLabel.FALSE]: 3,
  [VerdictLabel.DISPUTED]: 2,
  [VerdictLabel.MISLEADING]: 1,
  [VerdictLabel.UNVERIFIED]: 0,
};

/** Pick the most severe verdict in a post (or null if it has no verdicts). */
export function pickPrimaryVerdict(postVerdict: PostVerdict): Verdict | null {
  let best: Verdict | null = null;
  for (const verdict of postVerdict.verdicts) {
    if (!best || SEVERITY[verdict.label] > SEVERITY[best.label]) best = verdict;
  }
  return best;
}

/** A post is worth intervening on only if it has an actionable (non-UNVERIFIED) verdict. */
export function isActionable(label: VerdictLabel): boolean {
  return label !== VerdictLabel.UNVERIFIED;
}

export function toInterventionSources(verdict: Verdict): InterventionSource[] {
  return verdict.sources.map((s) => ({
    publisherName: s.publisherName,
    url: s.url,
    articleTitle: s.articleTitle,
  }));
}

/** Build the final hand-off object for the front-end. */
export function buildDecision(params: {
  postId: string;
  verdict: Verdict | null;
  tier: Tier;
  band: RiskBand;
  headline: string;
  body: string;
}): InterventionDecision {
  const { postId, verdict, tier, band, headline, body } = params;

  if (!verdict || !isActionable(verdict.label)) {
    return {
      postId,
      shouldIntervene: false,
      tier,
      verdictLabel: verdict?.label ?? VerdictLabel.UNVERIFIED,
      headline: "",
      body: "",
      sources: [],
      riskBand: band,
    };
  }

  return {
    postId,
    shouldIntervene: true,
    tier,
    verdictLabel: verdict.label,
    headline,
    body,
    sources: toInterventionSources(verdict),
    riskBand: band,
  };
}
