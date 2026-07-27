/**
 * Fast, page-session gate for reflective intervention actions. The Service Worker persists the
 * same invariant in RiskState; this gate prevents redundant messages before they leave the page.
 */
export interface PostInteractionGate {
  claim(postId: string): boolean;
}

export function createPostInteractionGate(): PostInteractionGate {
  const claimedPostIds = new Set<string>();

  return {
    claim(postId: string): boolean {
      if (claimedPostIds.has(postId)) return false;
      claimedPostIds.add(postId);
      return true;
    },
  };
}
