/**
 * Pure ranking for "related posts": order candidate posts by how much taxonomy
 * (categories + tags) they share with the source post, most-shared first. Ties
 * keep the input order, so callers should pass candidates already sorted by
 * recency. Framework-free for unit testing.
 */

export interface RankablePost {
  categories: { id: string }[];
  tags: { id: string }[];
}

/** Number of categories + tags a candidate shares with the source sets. */
export function relatedScore(
  post: RankablePost,
  categoryIds: ReadonlySet<string>,
  tagIds: ReadonlySet<string>,
): number {
  let score = 0;
  for (const c of post.categories) if (categoryIds.has(c.id)) score += 1;
  for (const t of post.tags) if (tagIds.has(t.id)) score += 1;
  return score;
}

/**
 * Rank candidates by shared-taxonomy score (desc), drop those with no overlap,
 * and cap at `limit`. Sort is stable so equal-score posts keep their recency order.
 */
export function rankRelated<T extends RankablePost>(
  candidates: T[],
  categoryIds: string[],
  tagIds: string[],
  limit: number,
): T[] {
  const catSet = new Set(categoryIds);
  const tagSet = new Set(tagIds);
  return candidates
    .map((post, index) => ({ post, index, score: relatedScore(post, catSet, tagSet) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.post);
}
