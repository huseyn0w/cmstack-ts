import 'server-only';

import type { BulkItemResult } from './bulk';

/**
 * Run `fn` for every id concurrently, isolating per-item failures. Reuses the
 * existing single-item admin endpoints (each already CASL-gated and observer-
 * wired), so a bulk action needs no new API surface. Returns one result per id.
 */
export async function runBulk(
  ids: string[],
  fn: (id: string) => Promise<unknown>,
): Promise<BulkItemResult[]> {
  const settled = await Promise.allSettled(ids.map((id) => fn(id)));
  return settled.map((outcome, i) => {
    const id = ids[i] as string;
    if (outcome.status === 'fulfilled') return { id, ok: true };
    const error = outcome.reason instanceof Error ? outcome.reason.message : 'Operation failed';
    return { id, ok: false, error };
  });
}
