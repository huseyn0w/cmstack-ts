import type { SearchRepository } from '@cmstack-ts/db';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchService } from './search.service';

let search: Record<keyof SearchRepository, Mock>;
let service: SearchService;

beforeEach(() => {
  search = { searchPosts: vi.fn(), countPosts: vi.fn() };
  service = new SearchService(search as unknown as SearchRepository);
});

describe('SearchService', () => {
  it('computes the offset, maps rows, and echoes the query/paging', async () => {
    search.searchPosts.mockResolvedValue([
      {
        id: 'p1',
        title: 'Hello',
        slug: 'hello',
        excerpt: null,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    search.countPosts.mockResolvedValue(1);

    const result = await service.search({ q: 'hello', page: 2, perPage: 10 });

    expect(search.searchPosts).toHaveBeenCalledWith('hello', 10, 10); // offset = (2-1)*10
    expect(search.countPosts).toHaveBeenCalledWith('hello');
    expect(result).toEqual({
      query: 'hello',
      total: 1,
      page: 2,
      perPage: 10,
      items: [
        {
          id: 'p1',
          title: 'Hello',
          slug: 'hello',
          excerpt: null,
          publishedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  });

  it('keeps a null publishedAt null', async () => {
    search.searchPosts.mockResolvedValue([
      { id: 'p1', title: 'T', slug: 's', excerpt: 'e', publishedAt: null },
    ]);
    search.countPosts.mockResolvedValue(1);
    const result = await service.search({ q: 'x', page: 1, perPage: 20 });
    expect(result.items[0]?.publishedAt).toBeNull();
  });
});
