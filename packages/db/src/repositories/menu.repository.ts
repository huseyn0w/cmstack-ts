import { type Menu, type Prisma, type PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

/** Nested include for the builder/public read: items (ordered) + their translations. */
export const menuWithTreeInclude = {
  items: {
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: { translations: true },
  },
} satisfies Prisma.MenuInclude;

export type MenuWithTree = Prisma.MenuGetPayload<{ include: typeof menuWithTreeInclude }>;
export type MenuItemRow = MenuWithTree['items'][number];
export type MenuItemTranslationRow = MenuItemRow['translations'][number];

export type MenuItemCreateData = {
  menuId: string;
  parentId: string | null;
  order: number;
  type: MenuItemRow['type'];
  label: string;
  targetId: string | null;
  url: string | null;
  openInNewTab: boolean;
};
export type MenuItemUpdateData = Partial<Omit<MenuItemCreateData, 'menuId'>>;
export type StructureNode = { id: string; parentId: string | null; order: number };

/** Data access for {@link Menu}, its nested {@link MenuItem} tree and translations. */
export interface MenuRepository {
  list(): Promise<Menu[]>;
  findById(id: string): Promise<MenuWithTree | null>;
  findByLocation(location: string): Promise<MenuWithTree | null>;
  create(data: { name: string; location: string }): Promise<Menu>;
  update(id: string, data: { name?: string; location?: string }): Promise<Menu>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
  // items
  createItem(data: MenuItemCreateData): Promise<MenuItemRow>;
  updateItem(id: string, data: MenuItemUpdateData): Promise<MenuItemRow>;
  itemExists(id: string, menuId: string): Promise<boolean>;
  deleteItem(id: string): Promise<void>;
  listItemIds(menuId: string): Promise<string[]>;
  /** Highest sibling `order` under a parent (null = roots) of a menu, or -1 if none. */
  maxOrder(menuId: string, parentId: string | null): Promise<number>;
  applyStructure(menuId: string, nodes: StructureNode[]): Promise<void>;
  // translations
  upsertTranslation(
    menuItemId: string,
    locale: string,
    data: { label: string | null },
  ): Promise<void>;
  deleteTranslation(menuItemId: string, locale: string): Promise<void>;
}

export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');

export class PrismaMenuRepository extends PrismaCrudRepository implements MenuRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.menu);
  }

  list(): Promise<Menu[]> {
    return this.prisma.menu.findMany({ orderBy: [{ location: 'asc' }] });
  }

  findById(id: string): Promise<MenuWithTree | null> {
    return this.prisma.menu.findUnique({ where: { id }, include: menuWithTreeInclude });
  }

  findByLocation(location: string): Promise<MenuWithTree | null> {
    return this.prisma.menu.findUnique({ where: { location }, include: menuWithTreeInclude });
  }

  create(data: { name: string; location: string }): Promise<Menu> {
    return this.prisma.menu.create({ data });
  }

  update(id: string, data: { name?: string; location?: string }): Promise<Menu> {
    return this.prisma.menu.update({ where: { id }, data });
  }

  createItem(data: MenuItemCreateData): Promise<MenuItemRow> {
    return this.prisma.menuItem.create({ data, include: { translations: true } });
  }

  updateItem(id: string, data: MenuItemUpdateData): Promise<MenuItemRow> {
    return this.prisma.menuItem.update({ where: { id }, data, include: { translations: true } });
  }

  async itemExists(id: string, menuId: string): Promise<boolean> {
    return (await this.prisma.menuItem.count({ where: { id, menuId } })) > 0;
  }

  async deleteItem(id: string): Promise<void> {
    await this.prisma.menuItem.delete({ where: { id } });
  }

  async listItemIds(menuId: string): Promise<string[]> {
    const rows = await this.prisma.menuItem.findMany({ where: { menuId }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async maxOrder(menuId: string, parentId: string | null): Promise<number> {
    const row = await this.prisma.menuItem.findFirst({
      where: { menuId, parentId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return row?.order ?? -1;
  }

  async applyStructure(_menuId: string, nodes: StructureNode[]): Promise<void> {
    await this.prisma.$transaction(
      nodes.map((n) =>
        this.prisma.menuItem.update({
          where: { id: n.id },
          data: { parentId: n.parentId, order: n.order },
        }),
      ),
    );
  }

  async upsertTranslation(
    menuItemId: string,
    locale: string,
    data: { label: string | null },
  ): Promise<void> {
    await this.prisma.menuItemTranslation.upsert({
      where: { menuItemId_locale: { menuItemId, locale } },
      create: { menuItemId, locale, label: data.label },
      update: { label: data.label },
    });
  }

  async deleteTranslation(menuItemId: string, locale: string): Promise<void> {
    await this.prisma.menuItemTranslation.delete({
      where: { menuItemId_locale: { menuItemId, locale } },
    });
  }
}
