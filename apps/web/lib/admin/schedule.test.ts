import { describe, expect, it } from 'vitest';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from './schedule';

describe('datetime-local conversion', () => {
  it('empty input is null / empty', () => {
    expect(fromDateTimeLocalValue('')).toBeNull();
    expect(toDateTimeLocalValue(null)).toBe('');
    expect(toDateTimeLocalValue(undefined)).toBe('');
  });

  it('round-trips a value to the minute', () => {
    const local = '2026-07-01T09:30';
    const iso = fromDateTimeLocalValue(local);
    expect(iso).not.toBeNull();
    expect(toDateTimeLocalValue(iso)).toBe(local);
  });
});
