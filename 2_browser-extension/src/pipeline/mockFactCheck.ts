// Pre-baked fact-check lookup.
//
// Instead of calling Gemini + the Google Fact Check API live, we read the pre-fact-checked posts
// from posts.json (the same data the mockup site serves) and return the stored verdict for a post
// by its id. This is packaged with the extension, so the service worker fetches it via
// chrome.runtime.getURL — no API keys required.
//
// The fact-check RESPONSE text (the human-readable explanation shown in the intervention) is a
// static placeholder for now; an LLM will generate it later. Swap out PLACEHOLDER_RESPONSE /
// generateResponse when that lands.
import { Source, Verdict, VerdictLabel } from "./types";

const POSTS_FILE = "posts.json";
const PLACEHOLDER_RESPONSE = "This content contains misinformation.";

// Shape of posts.json (snake_case, single `verdicts` object; `{}` when a post has no fact-check).
interface RawSource {
  publisher_name?: string;
  publisher_site?: string;
  url?: string;
  article_title?: string;
  rating?: string;
}
interface RawVerdict {
  claim?: { content?: string };
  label?: string;
  sources?: RawSource[];
}
interface RawPost {
  id: number | string;
  post?: string;
  verdicts?: RawVerdict;
}

export interface FactCheckResult {
  verdict: Verdict;
  /** Human-readable explanation for the intervention (LLM-generated later; static for now). */
  response: string;
}

// Parsed posts.json, indexed by string id. Loaded once, then cached for the worker's lifetime.
let postsIndex: Map<string, RawPost> | null = null;

async function loadPosts(): Promise<Map<string, RawPost>> {
  if (postsIndex) return postsIndex;
  const url = chrome.runtime.getURL(POSTS_FILE);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${POSTS_FILE}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as RawPost[];
  const index = new Map<string, RawPost>();
  for (const post of data) index.set(String(post.id), post);
  postsIndex = index;
  return index;
}

function normalizeSource(s: RawSource): Source {
  return {
    publisherName: s.publisher_name ?? "",
    publisherSite: s.publisher_site ?? "",
    url: s.url ?? "",
    articleTitle: s.article_title ?? "",
    rating: s.rating ?? "",
  };
}

function toVerdictLabel(label: string | undefined): VerdictLabel | null {
  switch ((label ?? "").toUpperCase()) {
    case "FALSE":
      return VerdictLabel.FALSE;
    case "MISLEADING":
      return VerdictLabel.MISLEADING;
    case "DISPUTED":
      return VerdictLabel.DISPUTED;
    case "UNVERIFIED":
      return VerdictLabel.UNVERIFIED;
    default:
      return null;
  }
}

/** Placeholder for the (future) LLM-generated explanation. */
function generateResponse(_verdict: Verdict): string {
  // TODO: replace with an LLM call that explains WHY the claim is misleading/false.
  return PLACEHOLDER_RESPONSE;
}

/**
 * Look up the pre-baked fact-check for a post by its id.
 * Returns null when the post is unknown or has an empty `verdicts` object (no misinformation).
 */
export async function factCheck(postId: string): Promise<FactCheckResult | null> {
  const posts = await loadPosts();
  const post = posts.get(String(postId));
  if (!post) return null;

  const raw = post.verdicts;
  // Empty `{}` (or missing) => no fact-check for this post.
  if (!raw || !raw.label) return null;

  const label = toVerdictLabel(raw.label);
  if (!label) return null;

  const verdict: Verdict = {
    claim: { content: raw.claim?.content ?? post.post ?? "" },
    label,
    sources: (raw.sources ?? []).map(normalizeSource),
  };

  return { verdict, response: generateResponse(verdict) };
}
