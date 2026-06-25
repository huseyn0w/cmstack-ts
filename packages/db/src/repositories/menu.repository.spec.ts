import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaMenuRepository } from './menu.repository';

// biome-ignore lint/suspicious/noExplicitAny: in-test Prisma double
function fakePrisma(): any {
  return {
    menu: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    menuItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    menuItemTranslation: { upsert: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: shared double
let p: any;
let repo: PrismaMenuRepository;

beforeEach(() => {
  p = fakePrisma();
  repo = new PrismaMenuRepository(p);
});

describe('PrismaMenuRepository', () => {
  it('findByLocation includes the nested item tree ordered by order asc, with translations', async () => {
    p.menu.findUnique.mockResolvedValue({ id: 'm1', location: 'primary', items: [] });
    await repo.findByLocation('primary');
    const arg = p.menu.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ location: 'primary' });
    expect(arg.include.items.orderBy).toEqual([{ order: 'asc' }, { createdAt: 'asc' }]);
    expect(arg.include.items.include.translations).toBeDefined();
  });

  it('findById uses the same nested include', async () => {
    p.menu.findUnique.mockResolvedValue(null);
    await repo.findById('m1');
    const arg = p.menu.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'm1' });
    expect(arg.include.items.include.translations).toBeDefined();
  });

  it('applyStructure issues one $transaction of per-node parentId/order updates', async () => {
    await repo.applyStructure('m1', [
      { id: 'a', parentId: null, order: 0 },
      { id: 'b', parentId: 'a', order: 0 },
    ]);
    expect(p.$transaction).toHaveBeenCalledTimes(1);
    expect(p.menuItem.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { parentId: null, order: 0 },
    });
    expect(p.menuItem.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { parentId: 'a', order: 0 },
    });
  });

  it('listItemIds returns the ids belonging to a menu', async () => {
    p.menuItem.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const ids = await repo.listItemIds('m1');
    expect(p.menuItem.findMany).toHaveBeenCalledWith({
      where: { menuId: 'm1' },
      select: { id: true },
    });
    expect(ids).toEqual(['a', 'b']);
  });

  it('itemExists scopes the count to the menu', async () => {
    p.menuItem.count.mockResolvedValue(1);
    expect(await repo.itemExists('i1', 'm1')).toBe(true);
    expect(p.menuItem.count).toHaveBeenCalledWith({ where: { id: 'i1', menuId: 'm1' } });
  });

  it('upsertTranslation writes a full row on the [menuItemId, locale] unique', async () => {
    await repo.upsertTranslation('i1', 'de', { label: 'Hallo' });
    const arg = p.menuItemTranslation.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ menuItemId_locale: { menuItemId: 'i1', locale: 'de' } });
    expect(arg.create).toEqual({ menuItemId: 'i1', locale: 'de', label: 'Hallo' });
    expect(arg.update).toEqual({ label: 'Hallo' });
  });

  it('createItem includes the translations relation in the returned row', async () => {
    p.menuItem.create.mockResolvedValue({ id: 'i1', translations: [] });
    await repo.createItem({
      menuId: 'm1',
      parentId: null,
      order: 0,
      type: 'CUSTOM',
      label: 'X',
      targetId: null,
      url: '/x',
      openInNewTab: false,
    });
    const arg = p.menuItem.create.mock.calls[0][0];
    expect(arg.include.translations).toBeDefined();
    expect(arg.data.menuId).toBe('m1');
  });
});
