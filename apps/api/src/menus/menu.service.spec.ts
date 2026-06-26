import { type MenuRepository, type MenuWithTree, Prisma } from '@cmstack-ts/db';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheService } from '../cache/cache.service';
import type { HookRegistry } from '../plugins/hook-registry';
import { MenuService } from './menu.service';

type Item = MenuWithTree['items'][number];

function item(over: Partial<Item>): Item {
  return {
    id: 'i1',
    menuId: 'm1',
    parentId: null,
    order: 0,
    type: 'CUSTOM',
    label: 'Home',
    targetId: null,
    url: '/',
    openInNewTab: false,
    translations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Item;
}

function menuTree(items: Item[]): MenuWithTree {
  return {
    id: 'm1',
    name: 'Main',
    location: 'primary',
    createdAt: new Date(),
    updatedAt: new Date(),
    items,
  } as MenuWithTree;
}

let menus: Record<keyof MenuRepository, Mock>;
let posts: { slugsByIds: Mock };
let pages: { slugsByIds: Mock };
let categories: { slugsByIds: Mock };
let cache: { getOrSet: Mock; invalidate: Mock };
let hooks: { emit: Mock };
let service: MenuService;

beforeEach(() => {
  menus = {
    list: vi.fn(),
    findById: vi.fn(),
    findByLocation: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    itemExists: vi.fn(),
    deleteItem: vi.fn(),
    listItemIds: vi.fn(),
    maxOrder: vi.fn().mockResolvedValue(-1),
    applyStructure: vi.fn(),
    upsertTranslation: vi.fn(),
    deleteTranslation: vi.fn(),
  };
  posts = { slugsByIds: vi.fn().mockResolvedValue({}) };
  pages = { slugsByIds: vi.fn().mockResolvedValue({}) };
  categories = { slugsByIds: vi.fn().mockResolvedValue({}) };
  cache = {
    getOrSet: vi.fn((_key: string, factory: () => Promise<unknown>) => factory()),
    invalidate: vi.fn(),
  };
  hooks = { emit: vi.fn().mockResolvedValue(undefined) };
  service = new MenuService(
    menus as unknown as MenuRepository,
    posts as never,
    pages as never,
    categories as never,
    cache as unknown as CacheService,
    hooks as unknown as HookRegistry,
  );
});

describe('getPublicMenu', () => {
  it('resolves urls, overlays the locale label, nests children, drops unresolved targets', async () => {
    posts.slugsByIds.mockResolvedValue({ p1: 'hello' });
    menus.findByLocation.mockResolvedValue(
      menuTree([
        item({
          id: 'a',
          type: 'POST',
          targetId: 'p1',
          url: null,
          label: 'Post',
          translations: [
            {
              id: 't',
              menuItemId: 'a',
              locale: 'de',
              label: 'Beitrag',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
        item({
          id: 'b',
          parentId: 'a',
          type: 'POST',
          targetId: 'missing',
          url: null,
          label: 'Gone',
        }),
        item({ id: 'c', type: 'CUSTOM', url: '/x', label: 'X' }),
      ]),
    );
    const menu = await service.getPublicMenu('primary', 'de');
    expect(menu.items).toHaveLength(2);
    expect(menu.items[0]).toMatchObject({ label: 'Beitrag', url: '/blog/hello', children: [] });
    expect(menu.items[1]).toMatchObject({ label: 'X', url: '/x' });
  });

  it('falls back to the base label when the locale has no override', async () => {
    menus.findByLocation.mockResolvedValue(
      menuTree([item({ id: 'a', type: 'CUSTOM', url: '/x', label: 'Base' })]),
    );
    const menu = await service.getPublicMenu('primary', 'ru');
    expect(menu.items[0]?.label).toBe('Base');
  });

  it('returns an empty tree for an unknown location', async () => {
    menus.findByLocation.mockResolvedValue(null);
    expect((await service.getPublicMenu('nope', 'en')).items).toEqual([]);
  });

  it('drops a child whose parent was dropped (orphan not promoted to root)', async () => {
    // parent 'a' is a POST with a missing target → dropped; child 'b' must not become a root
    menus.findByLocation.mockResolvedValue(
      menuTree([
        item({ id: 'a', type: 'POST', targetId: 'missing', url: null }),
        item({ id: 'b', parentId: 'a', type: 'CUSTOM', url: '/b' }),
      ]),
    );
    const menu = await service.getPublicMenu('primary', 'en');
    expect(menu.items).toEqual([]);
  });
});

describe('createMenu', () => {
  it('maps a duplicate location P2002 to 409', async () => {
    menus.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' }),
    );
    await expect(service.createMenu({ name: 'A', location: 'primary' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns the summary on success', async () => {
    menus.create.mockResolvedValue({ id: 'm1', name: 'A', location: 'primary' });
    expect(await service.createMenu({ name: 'A', location: 'primary' })).toEqual({
      id: 'm1',
      name: 'A',
      location: 'primary',
    });
  });
});

describe('createItem', () => {
  it('rejects a reference item whose target does not exist', async () => {
    menus.exists.mockResolvedValue(true);
    posts.slugsByIds.mockResolvedValue({});
    await expect(
      service.createItem('m1', { type: 'POST', label: 'X', targetId: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsafe custom url', async () => {
    menus.exists.mockResolvedValue(true);
    await expect(
      service.createItem('m1', { type: 'CUSTOM', label: 'X', url: 'javascript:1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 404 when the menu does not exist', async () => {
    menus.exists.mockResolvedValue(false);
    await expect(
      service.createItem('m1', { type: 'CUSTOM', label: 'X', url: '/x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('appends after the last sibling order and persists a normalized custom url', async () => {
    menus.exists.mockResolvedValue(true);
    menus.maxOrder.mockResolvedValue(2);
    menus.createItem.mockResolvedValue(item({ id: 'new', order: 3, url: '/x', translations: [] }));
    await service.createItem('m1', { type: 'CUSTOM', label: 'X', url: '/x' });
    const arg = menus.createItem.mock.calls[0]?.[0];
    expect(arg.order).toBe(3);
    expect(arg.url).toBe('/x');
    expect(arg.targetId).toBeNull();
  });
});

describe('applyStructure', () => {
  it('rejects a node id that is not in the menu', async () => {
    menus.exists.mockResolvedValue(true);
    menus.listItemIds.mockResolvedValue(['a']);
    await expect(
      service.applyStructure('m1', { nodes: [{ id: 'b', parentId: null, order: 0 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a parent cycle', async () => {
    menus.exists.mockResolvedValue(true);
    menus.listItemIds.mockResolvedValue(['a', 'b']);
    await expect(
      service.applyStructure('m1', {
        nodes: [
          { id: 'a', parentId: 'b', order: 0 },
          { id: 'b', parentId: 'a', order: 0 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies a valid structure', async () => {
    menus.exists.mockResolvedValue(true);
    menus.listItemIds.mockResolvedValue(['a', 'b']);
    await service.applyStructure('m1', {
      nodes: [
        { id: 'a', parentId: null, order: 0 },
        { id: 'b', parentId: 'a', order: 0 },
      ],
    });
    expect(menus.applyStructure).toHaveBeenCalledWith('m1', [
      { id: 'a', parentId: null, order: 0 },
      { id: 'b', parentId: 'a', order: 0 },
    ]);
  });

  it('emits menu.changed after applying a structure', async () => {
    menus.exists.mockResolvedValue(true);
    menus.listItemIds.mockResolvedValue(['a']);
    await service.applyStructure('m1', { nodes: [{ id: 'a', parentId: null, order: 0 }] });
    expect(hooks.emit).toHaveBeenCalledWith('menu.changed', expect.any(Object));
  });
});

describe('menu cache', () => {
  it('reads the public menu through the cache', async () => {
    menus.findByLocation.mockResolvedValue(null);
    await service.getPublicMenu('primary', 'en');
    expect(cache.getOrSet).toHaveBeenCalled();
  });
});

describe('upsertTranslation', () => {
  it('deletes the override when the label is empty', async () => {
    menus.itemExists.mockResolvedValue(true);
    await service.upsertTranslation('m1', 'i1', 'de', { label: '   ' });
    expect(menus.deleteTranslation).toHaveBeenCalledWith('i1', 'de');
    expect(menus.upsertTranslation).not.toHaveBeenCalled();
  });

  it('upserts a non-empty label', async () => {
    menus.itemExists.mockResolvedValue(true);
    await service.upsertTranslation('m1', 'i1', 'de', { label: 'Hallo' });
    expect(menus.upsertTranslation).toHaveBeenCalledWith('i1', 'de', { label: 'Hallo' });
  });

  it('404s when the item is not in the menu', async () => {
    menus.itemExists.mockResolvedValue(false);
    await expect(
      service.upsertTranslation('m1', 'i1', 'de', { label: 'Hallo' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('getMenu (admin)', () => {
  it('returns the full nested tree with all translation rows and no slug resolution', async () => {
    menus.findById.mockResolvedValue(
      menuTree([
        item({
          id: 'a',
          type: 'POST',
          targetId: 'p1',
          url: null,
          translations: [
            {
              id: 't',
              menuItemId: 'a',
              locale: 'de',
              label: 'DE',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
        item({ id: 'b', parentId: 'a', type: 'CUSTOM', url: '/b' }),
      ]),
    );
    const menu = await service.getMenu('m1');
    expect(posts.slugsByIds).not.toHaveBeenCalled();
    expect(menu.items).toHaveLength(1);
    expect(menu.items[0]).toMatchObject({ id: 'a', type: 'POST', targetId: 'p1' });
    expect(menu.items[0]?.translations).toEqual([{ locale: 'de', label: 'DE' }]);
    expect(menu.items[0]?.children[0]).toMatchObject({ id: 'b', url: '/b' });
  });

  it('404s for an unknown menu', async () => {
    menus.findById.mockResolvedValue(null);
    await expect(service.getMenu('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('listMenus', () => {
  it('maps menu rows to summaries', async () => {
    menus.list.mockResolvedValue([
      { id: 'm1', name: 'A', location: 'primary', createdAt: new Date(), updatedAt: new Date() },
    ]);
    expect(await service.listMenus()).toEqual([{ id: 'm1', name: 'A', location: 'primary' }]);
  });
});

describe('updateMenu', () => {
  it('returns the updated summary', async () => {
    menus.update.mockResolvedValue({ id: 'm1', name: 'B', location: 'footer' });
    expect(await service.updateMenu('m1', { name: 'B' })).toEqual({
      id: 'm1',
      name: 'B',
      location: 'footer',
    });
  });

  it('maps P2025 to 404', async () => {
    menus.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.updateMenu('m1', { name: 'B' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a duplicate location P2002 to 409', async () => {
    menus.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '5' }),
    );
    await expect(service.updateMenu('m1', { location: 'primary' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('deleteMenu', () => {
  it('deletes an existing menu', async () => {
    menus.hardDelete.mockResolvedValue(undefined);
    await service.deleteMenu('m1');
    expect(menus.hardDelete).toHaveBeenCalledWith('m1');
  });

  it('maps P2025 to 404', async () => {
    menus.hardDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.deleteMenu('m1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('item create/update/delete', () => {
  it('creates a PAGE item after validating the target exists', async () => {
    menus.exists.mockResolvedValue(true);
    pages.slugsByIds.mockResolvedValue({ pg1: 'about' });
    menus.maxOrder.mockResolvedValue(-1);
    menus.createItem.mockResolvedValue(item({ id: 'n', type: 'PAGE', targetId: 'pg1', url: null }));
    await service.createItem('m1', { type: 'PAGE', label: 'About', targetId: 'pg1' });
    const arg = menus.createItem.mock.calls[0]?.[0];
    expect(arg.type).toBe('PAGE');
    expect(arg.targetId).toBe('pg1');
    expect(arg.order).toBe(0);
  });

  it('updates a reference item, validating the new CATEGORY target', async () => {
    menus.itemExists.mockResolvedValue(true);
    categories.slugsByIds.mockResolvedValue({ c1: 'guides' });
    menus.updateItem.mockResolvedValue(
      item({ id: 'i1', type: 'CATEGORY', targetId: 'c1', url: null }),
    );
    await service.updateItem('m1', 'i1', { type: 'CATEGORY', label: 'Guides', targetId: 'c1' });
    expect(menus.updateItem).toHaveBeenCalled();
  });

  it('404s updating an item not in the menu', async () => {
    menus.itemExists.mockResolvedValue(false);
    await expect(
      service.updateItem('m1', 'i1', { type: 'CUSTOM', label: 'X', url: '/x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an item that belongs to the menu', async () => {
    menus.itemExists.mockResolvedValue(true);
    await service.deleteItem('m1', 'i1');
    expect(menus.deleteItem).toHaveBeenCalledWith('i1');
  });

  it('404s deleting an item not in the menu', async () => {
    menus.itemExists.mockResolvedValue(false);
    await expect(service.deleteItem('m1', 'i1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('getPublicMenu reference resolution', () => {
  it('resolves PAGE and CATEGORY targets to their urls', async () => {
    pages.slugsByIds.mockResolvedValue({ pg1: 'about' });
    categories.slugsByIds.mockResolvedValue({ c1: 'guides' });
    menus.findByLocation.mockResolvedValue(
      menuTree([
        item({ id: 'a', type: 'PAGE', targetId: 'pg1', url: null, label: 'About' }),
        item({ id: 'b', type: 'CATEGORY', targetId: 'c1', url: null, label: 'Guides' }),
      ]),
    );
    const menu = await service.getPublicMenu('primary', 'en');
    expect(menu.items.map((i) => i.url)).toEqual(['/about', '/blog?category=guides']);
  });

  it('falls back to the default locale for an unknown locale', async () => {
    menus.findByLocation.mockResolvedValue(
      menuTree([
        item({
          id: 'a',
          type: 'CUSTOM',
          url: '/x',
          label: 'Base',
          translations: [
            {
              id: 't',
              menuItemId: 'a',
              locale: 'de',
              label: 'DE',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
      ]),
    );
    const menu = await service.getPublicMenu('primary', 'zz');
    expect(menu.items[0]?.label).toBe('Base'); // zz → en (default), no en override → base
  });
});

describe('deleteTranslation idempotency', () => {
  it('swallows P2025 (already absent)', async () => {
    menus.itemExists.mockResolvedValue(true);
    menus.deleteTranslation.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.deleteTranslation('m1', 'i1', 'de')).resolves.toBeUndefined();
  });
});
