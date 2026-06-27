export type Post = {
  content: string;
};

export type Claim = {
  content: string;
};

export type Source = {
  publisherName: string;
  publisherSite: string;
  url: string;
  articleTitle: string;
  rating: string;
};

export type FactCheck = {
  claimText: string;
  source: Source;
  factCheckDate: string;
};

export type SourceAlignment = {
  source: Source;
  verdict: "CONTRADICTED" | "MISLEADING" | "UNVERIFIED";
};

export type AlignmentResult = {
  claim: string;
  alignments: SourceAlignment[];
};

export type Verdict = {
  claim: Claim;
  label: VerdictLabel;
  sources: Source[];
};

export type PostVerdict = {
  post: Post;
  verdicts: Verdict[];
};

export type UserResponse = {
  verdicts: PostVerdict[];
};

export enum VerdictLabel {
  FALSE = "FALSE",
  MISLEADING = "MISLEADING",
  DISPUTED = "DISPUTED",
  UNVERIFIED = "UNVERIFIED",
}
