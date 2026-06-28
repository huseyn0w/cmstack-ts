import { describe, expect, it } from 'vitest';
import {
  type BulkItemResult,
  bulkResultMessage,
  headerSelectionState,
  summarizeBulk,
  toggleSelection,
} from './bulk';

const r = (id: string, ok: boolean, error?: string): BulkItemResult => ({ id, ok, error });

describe('summarizeBulk', () => {
  it('counts successes and failures and surfaces the first error', () => {
    expect(summarizeBulk([r('a', true), r('b', false, 'boom'), r('c', false, 'later')])).toEqual({
      succeeded: 1,
      failed: 2,
      firstError: 'boom',
    });
  });

  it('omits firstError when everything succeeds', () => {
    expect(summarizeBulk([r('a', true), r('b', true)])).toEqual({ succeeded: 2, failed: 0 });
  });

  it('handles an empty input', () => {
    expect(summarizeBulk([])).toEqual({ succeeded: 0, failed: 0 });
  });
});

describe('bulkResultMessage', () => {
  it('pluralizes the all-success case', () => {
    expect(bulkResultMessage({ succeeded: 3, failed: 0 }, 'deleted', 'post')).toBe(
      '3 posts deleted',
    );
    expect(bulkResultMessage({ succeeded: 1, failed: 0 }, 'published', 'page')).toBe(
      '1 page published',
    );
  });

  it('reports a total failure', () => {
    expect(bulkResultMessage({ succeeded: 0, failed: 2 }, 'deleted', 'post')).toBe(
      'Failed to delet 2 posts',
    );
  });

  it('reports a partial failure', () => {
    expect(bulkResultMessage({ succeeded: 2, failed: 1 }, 'restored', 'post')).toBe(
      '2 posts restored, 1 failed',
    );
  });
});

describe('toggleSelection', () => {
  it('adds an unselected id and removes a selected one, immutably', () => {
    const a = new Set<string>(['x']);
    const b = toggleSelection(a, 'y');
    expect([...b].sort()).toEqual(['x', 'y']);
    expect([...a]).toEqual(['x']); // unchanged
    const c = toggleSelection(b, 'x');
    expect([...c]).toEqual(['y']);
  });
});

describe('headerSelectionState', () => {
  it('maps counts to all/some/none', () => {
    expect(headerSelectionState(0, 5)).toBe('none');
    expect(headerSelectionState(2, 5)).toBe('some');
    expect(headerSelectionState(5, 5)).toBe('all');
    expect(headerSelectionState(0, 0)).toBe('none'); // empty list is never "all"
  });
});
