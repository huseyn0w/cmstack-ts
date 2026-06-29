import type { SearchRepository } from '@cmstack-ts/db';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchService } from './search.service';

let search: Record<keyof SearchRepository, Mock>;
let service: SearchService;

beforeEach(() => {
  search = { search: vi.fn(), count: vi.fn() };
  service = new SearchService(search as unknown as SearchRepository);
});

describe('SearchService', () => {
  it('computes the offset, maps rows (with type), and echoes the query/paging', async () => {
    search.search.mockResolvedValue([
      {
        id: 'p1',
        type: 'post',
        title: 'Hello',
        slug: 'hello',
        excerpt: null,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    search.count.mockResolvedValue(1);

    const result = await service.search({ q: 'hello', page: 2, perPage: 10 });

    // default locale => no translation overlay (undefined); offset = (2-1)*10
    expect(search.search).toHaveBeenCalledWith('hello', undefined, 10, 10);
    expect(search.count).toHaveBeenCalledWith('hello', undefined);
    expect(result).toEqual({
      query: 'hello',
      total: 1,
      page: 2,
      perPage: 10,
      items: [
        {
          id: 'p1',
          type: 'post',
          title: 'Hello',
          slug: 'hello',
          excerpt: null,
          publishedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  });

  it('passes a non-default locale through as the translation overlay', async () => {
    search.search.mockResolvedValue([]);
    search.count.mockResolvedValue(0);
    await service.search({ q: 'x', page: 1, perPage: 20 }, 'de');
    expect(search.search).toHaveBeenCalledWith('x', 'de', 20, 0);
    expect(search.count).toHaveBeenCalledWith('x', 'de');
  });

  it('keeps a null publishedAt null and carries the page type', async () => {
    search.search.mockResolvedValue([
      { id: 'pg1', type: 'page', title: 'T', slug: 's', excerpt: null, publishedAt: null },
    ]);
    search.count.mockResolvedValue(1);
    const result = await service.search({ q: 'x', page: 1, perPage: 20 });
    expect(result.items[0]?.publishedAt).toBeNull();
    expect(result.items[0]?.type).toBe('page');
  });
});
