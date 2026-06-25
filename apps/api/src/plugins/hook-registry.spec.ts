import type { PostDetail } from '@cmstack-ts/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { HookRegistry } from './hook-registry';

function makePost(content: string): PostDetail {
  return {
    id: 'p1',
    title: 'Title',
    slug: 'title',
    excerpt: null,
    status: 'PUBLISHED',
    publishedAt: null,
    noindex: false,
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    author: null,
    categories: [],
    tags: [],
    translations: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content,
  };
}

describe('HookRegistry — filters', () => {
  let registry: HookRegistry;
  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('returns the value unchanged when no filter is registered', async () => {
    const post = makePost('<p>hi</p>');
    expect(await registry.applyFilters('public.post.render', post)).toBe(post);
  });

  it('threads the value through a registered filter', async () => {
    registry.addFilter('public.post.render', (post) => ({
      ...post,
      content: `<b>${post.content}</b>`,
    }));
    const out = await registry.applyFilters('public.post.render', makePost('hi'));
    expect(out.content).toBe('<b>hi</b>');
  });

  it('runs filters in ascending priority order', async () => {
    registry.addFilter('public.post.render', (p) => ({ ...p, content: `${p.content}B` }), 20);
    registry.addFilter('public.post.render', (p) => ({ ...p, content: `${p.content}A` }), 10);
    const out = await registry.applyFilters('public.post.render', makePost('x'));
    expect(out.content).toBe('xAB');
  });

  it('awaits async filter handlers', async () => {
    registry.addFilter('public.post.render', async (p) => ({ ...p, content: `${p.content}!` }));
    const out = await registry.applyFilters('public.post.render', makePost('hi'));
    expect(out.content).toBe('hi!');
  });
});

describe('HookRegistry — actions', () => {
  let registry: HookRegistry;
  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('invokes every action listener with the payload', async () => {
    const seen: string[] = [];
    registry.addAction('post.published', (p) => {
      seen.push(`a:${p.slug}`);
    });
    registry.addAction('post.published', (p) => {
      seen.push(`b:${p.slug}`);
    });
    await registry.emit('post.published', { id: '1', slug: 'hello', title: 'Hello' });
    expect(seen).toEqual(['a:hello', 'b:hello']);
  });

  it('is a no-op when no listener is registered', async () => {
    await expect(
      registry.emit('post.published', { id: '1', slug: 's', title: 'T' }),
    ).resolves.toBeUndefined();
  });

  it('isolates a throwing listener: it does not reject and later listeners still run', async () => {
    const seen: string[] = [];
    registry.addAction('post.published', () => {
      throw new Error('boom');
    });
    registry.addAction('post.published', (p) => {
      seen.push(p.slug);
    });
    await expect(
      registry.emit('post.published', { id: '1', slug: 'survives', title: 'T' }),
    ).resolves.toBeUndefined();
    expect(seen).toEqual(['survives']);
  });
});
