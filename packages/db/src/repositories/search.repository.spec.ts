import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaSearchRepository } from './search.repository';

type CapturedSql = { values: unknown[]; sql: string };

function make() {
  const $queryRaw = vi.fn();
  const prisma = { $queryRaw } as unknown as PrismaClient;
  return { repo: new PrismaSearchRepository(prisma), $queryRaw };
}

describe('PrismaSearchRepository', () => {
  it('searchPosts() passes the user query as a BOUND parameter, never interpolated', async () => {
    const { repo, $queryRaw } = make();
    $queryRaw.mockResolvedValue([]);
    await repo.searchPosts("o'brien; DROP TABLE", 10, 20);

    const sql = $queryRaw.mock.calls[0]?.[0] as CapturedSql;
    // the raw query value rides in the bound parameter list...
    expect(sql.values).toContain("o'brien; DROP TABLE");
    // ...and is NOT spliced into the SQL text
    expect(sql.sql).not.toContain('DROP TABLE');
    // ranking + tie-break ordering preserved verbatim
    expect(sql.sql).toContain('NULLS LAST');
    expect(sql.sql).toContain('ts_rank');
  });

  it('countPosts() coerces the bigint count to a number and guards empty results', async () => {
    const { repo, $queryRaw } = make();
    $queryRaw.mockResolvedValue([{ count: 7n }]);
    expect(await repo.countPosts('hello')).toBe(7);

    $queryRaw.mockResolvedValue([]);
    expect(await repo.countPosts('hello')).toBe(0);
  });
});
