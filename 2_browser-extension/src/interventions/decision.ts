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
    // Publisher names are link labels in the intervention UI. The mock data should always
    // provide one, but keep a visible fallback so a valid source never becomes an empty link.
    publisherName: s.publisherName.trim() || s.publisherSite.trim() || "Source",
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
  /** Defaults to true for an actionable verdict; false keeps the verdict for behaviour tracking
   * while withholding its UI below the Risk Score intervention floor. */
  shouldIntervene?: boolean;
}): InterventionDecision {
  const { postId, verdict, tier, band, headline, body } = params;
  const isFlagged = Boolean(verdict && isActionable(verdict.label));
  const shouldIntervene = isFlagged && params.shouldIntervene !== false;

  if (!isFlagged || !verdict) {
    return {
      postId,
      shouldIntervene: false,
      isFlagged: false,
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
    shouldIntervene,
    isFlagged: true,
    tier,
    verdictLabel: verdict.label,
    // Hidden decisions must not carry wording or source UI data. The content script only needs
    // `isFlagged` to score a later like/share.
    headline: shouldIntervene ? headline : "",
    body: shouldIntervene ? body : "",
    sources: shouldIntervene ? toInterventionSources(verdict) : [],
    riskBand: band,
  };
}
