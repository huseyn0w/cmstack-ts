/**
 * Pure helpers for bulk admin-list actions. Framework-free so the result
 * aggregation and selection maths can be unit-tested without React/network.
 */

/** Outcome of one item in a bulk operation. */
export interface BulkItemResult {
  id: string;
  ok: boolean;
  error?: string;
}

export interface BulkSummary {
  succeeded: number;
  failed: number;
  /** The first failure's message, if any — surfaced in the toast. */
  firstError?: string;
}

/** Aggregate per-item outcomes into counts + the first error message. */
export function summarizeBulk(results: BulkItemResult[]): BulkSummary {
  const failures = results.filter((r) => !r.ok);
  const firstError = failures.find((f) => f.error)?.error;
  return {
    succeeded: results.length - failures.length,
    failed: failures.length,
    ...(firstError ? { firstError } : {}),
  };
}

/**
 * Human toast message for a finished bulk run. `verb` is the past-tense action
 * ("deleted", "published"); `noun` is the singular item name ("post").
 */
export function bulkResultMessage(summary: BulkSummary, verb: string, noun: string): string {
  const { succeeded, failed } = summary;
  const items = (n: number) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  if (failed === 0) return `${items(succeeded)} ${verb}`;
  if (succeeded === 0) return `Failed to ${verb.replace(/ed$/, '')} ${items(failed)}`;
  return `${items(succeeded)} ${verb}, ${failed} failed`;
}

/** Toggle one id in a selection set, returning a new set (immutable update). */
export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Header checkbox state for a list: 'all' when every row is selected,
 * 'some' when a non-empty subset is, else 'none'.
 */
export function headerSelectionState(
  selectedCount: number,
  total: number,
): 'all' | 'some' | 'none' {
  if (total > 0 && selectedCount >= total) return 'all';
  if (selectedCount > 0) return 'some';
  return 'none';
}
