import type { PostDetail } from '@cmstack-ts/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { HookRegistry } from './hook-registry';
import { scopedPluginApi } from './scoped-plugin-api';

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

describe('HookRegistry owner gating + regions', () => {
  it('skips a disabled owner but runs un-owned (core) handlers', async () => {
    const reg = new HookRegistry();
    reg.addFilter('public.post.render', (p) => ({ ...p, title: `${p.title}-core` })); // un-owned
    reg.addFilter('public.post.render', (p) => ({ ...p, title: `${p.title}-plug` }), 10, 'p1');
    reg.setEnabledPlugins([]); // p1 disabled
    const base = { title: 'T' } as never;
    const out = (await reg.applyFilters('public.post.render', base)) as { title: string };
    expect(out.title).toBe('T-core'); // core ran, plugin skipped
    reg.setEnabledPlugins(['p1']);
    const out2 = (await reg.applyFilters('public.post.render', base)) as { title: string };
    expect(out2.title).toBe('T-core-plug');
  });

  it('renderRegion concatenates enabled contributors in priority order', async () => {
    const reg = new HookRegistry();
    reg.addRegion('site.footer', () => 'B', 20, 'p2');
    reg.addRegion('site.footer', () => 'A', 10, 'p1');
    reg.setEnabledPlugins(['p1', 'p2']);
    expect(await reg.renderRegion('site.footer')).toBe('AB');
    reg.setEnabledPlugins(['p2']);
    expect(await reg.renderRegion('site.footer')).toBe('B');
  });

  it('isolates a throwing region renderer', async () => {
    const reg = new HookRegistry();
    reg.addRegion(
      'site.footer',
      () => {
        throw new Error('boom');
      },
      10,
      'p1',
    );
    reg.addRegion('site.footer', () => 'ok', 20, 'p2');
    reg.setEnabledPlugins(['p1', 'p2']);
    expect(await reg.renderRegion('site.footer')).toBe('ok');
  });

  it('scopedPluginApi tags handlers with the owner id', async () => {
    const reg = new HookRegistry();
    scopedPluginApi(reg, 'p9').addRegion('site.footer', () => 'X');
    reg.setEnabledPlugins([]);
    expect(await reg.renderRegion('site.footer')).toBe('');
    reg.setEnabledPlugins(['p9']);
    expect(await reg.renderRegion('site.footer')).toBe('X');
  });
});
