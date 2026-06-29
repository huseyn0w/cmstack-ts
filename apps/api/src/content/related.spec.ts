import { describe, expect, it } from 'vitest';
import { type RankablePost, rankRelated, relatedScore } from './related';

const post = (categories: string[], tags: string[]): RankablePost => ({
  categories: categories.map((id) => ({ id })),
  tags: tags.map((id) => ({ id })),
});

describe('relatedScore', () => {
  it('counts shared categories and tags', () => {
    expect(relatedScore(post(['c1', 'c2'], ['t1']), new Set(['c1']), new Set(['t1', 't9']))).toBe(
      2,
    );
    expect(relatedScore(post(['c3'], ['t3']), new Set(['c1']), new Set(['t1']))).toBe(0);
  });
});

describe('rankRelated', () => {
  it('orders by shared-taxonomy score, most-shared first', () => {
    const candidates = [
      { id: 'a', ...post(['c1'], []) }, // score 1
      { id: 'b', ...post(['c1', 'c2'], ['t1']) }, // score 3
      { id: 'c', ...post(['c2'], ['t1']) }, // score 2
    ];
    const ranked = rankRelated(candidates, ['c1', 'c2'], ['t1'], 5);
    expect(ranked.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('drops candidates with no overlap and respects the limit', () => {
    const candidates = [
      { id: 'a', ...post(['c1'], []) },
      { id: 'b', ...post(['x'], ['y']) }, // no overlap
      { id: 'c', ...post([], ['t1']) },
    ];
    const ranked = rankRelated(candidates, ['c1'], ['t1'], 1);
    expect(ranked.map((p) => p.id)).toEqual(['a']); // limit 1, 'b' dropped
  });

  it('keeps the input (recency) order for equal scores', () => {
    const candidates = [
      { id: 'first', ...post(['c1'], []) },
      { id: 'second', ...post(['c1'], []) },
    ];
    expect(rankRelated(candidates, ['c1'], [], 5).map((p) => p.id)).toEqual(['first', 'second']);
  });
});
