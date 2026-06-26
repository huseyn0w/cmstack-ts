import {
  type CreateMenuInput,
  type CreateMenuItemInput,
  DEFAULT_LOCALE,
  LOCALES,
  type MenuItemTranslationInput,
  type MenuItemType,
  type MenuNode,
  type MenuStructureInput,
  type MenuSummary,
  type PublicMenu,
  type UpdateMenuInput,
  type UpdateMenuItemInput,
  normalizeCustomUrl,
  resolveMenuItemUrl,
} from '@cmstack-ts/config';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
  MENU_REPOSITORY,
  type MenuItemRow,
  type MenuRepository,
  type MenuWithTree,
  PAGE_REPOSITORY,
  POST_REPOSITORY,
  type PageRepository,
  type PostRepository,
  Prisma,
} from '@cmstack-ts/db';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_NS, cacheKey } from '../cache/cache.keys';
import { CacheService } from '../cache/cache.service';
import { HookRegistry } from '../plugins/hook-registry';

/** Admin builder view of a single item (raw fields + nested children + all locales). */
export type AdminMenuItem = {
  id: string;
  parentId: string | null;
  order: number;
  type: MenuItemType;
  label: string;
  targetId: string | null;
  url: string | null;
  openInNewTab: boolean;
  translations: { locale: string; label: string | null }[];
  children: AdminMenuItem[];
};
export type AdminMenu = { id: string; name: string; location: string; items: AdminMenuItem[] };

function isKnownError(e: unknown, code: string): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
}

@Injectable()
export class MenuService {
  constructor(
    @Inject(MENU_REPOSITORY) private readonly menus: MenuRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(PAGE_REPOSITORY) private readonly pages: PageRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    private readonly cache: CacheService,
    private readonly hooks: HookRegistry,
  ) {}

  // --- Menus -----------------------------------------------------------------

  async listMenus(): Promise<MenuSummary[]> {
    const menus = await this.menus.list();
    return menus.map((m) => ({ id: m.id, name: m.name, location: m.location }));
  }

  async createMenu(input: CreateMenuInput): Promise<MenuSummary> {
    try {
      const m = await this.menus.create({ name: input.name, location: input.location });
      await this.hooks.emit('menu.changed', { location: m.location });
      return { id: m.id, name: m.name, location: m.location };
    } catch (e) {
      if (isKnownError(e, 'P2002'))
        throw new ConflictException('A menu already exists for this location');
      throw e;
    }
  }

  async updateMenu(id: string, input: UpdateMenuInput): Promise<MenuSummary> {
    try {
      const m = await this.menus.update(id, input);
      await this.hooks.emit('menu.changed', { location: m.location });
      return { id: m.id, name: m.name, location: m.location };
    } catch (e) {
      if (isKnownError(e, 'P2002'))
        throw new ConflictException('A menu already exists for this location');
      if (isKnownError(e, 'P2025')) throw new NotFoundException('Menu not found');
      throw e;
    }
  }

  async deleteMenu(id: string): Promise<void> {
    try {
      await this.menus.hardDelete(id);
      await this.hooks.emit('menu.changed', {});
    } catch (e) {
      if (isKnownError(e, 'P2025')) throw new NotFoundException('Menu not found');
      throw e;
    }
  }

  async getMenu(id: string): Promise<AdminMenu> {
    const menu = await this.menus.findById(id);
    if (!menu) throw new NotFoundException('Menu not found');
    return {
      id: menu.id,
      name: menu.name,
      location: menu.location,
      items: this.toAdminTree(menu.items),
    };
  }

  // --- Items -----------------------------------------------------------------

  async createItem(menuId: string, input: CreateMenuItemInput): Promise<AdminMenuItem> {
    if (!(await this.menus.exists(menuId))) throw new NotFoundException('Menu not found');
    const { targetId, url } = await this.validateItemTarget(input);
    const parentId = input.parentId ?? null;
    const order = input.order ?? (await this.menus.maxOrder(menuId, parentId)) + 1;
    const row = await this.menus.createItem({
      menuId,
      parentId,
      order,
      type: input.type,
      label: input.label,
      targetId,
      url,
      openInNewTab: input.openInNewTab ?? false,
    });
    await this.hooks.emit('menu.changed', {});
    return this.toAdminItem(row, []);
  }

  async updateItem(
    menuId: string,
    itemId: string,
    input: UpdateMenuItemInput,
  ): Promise<AdminMenuItem> {
    if (!(await this.menus.itemExists(itemId, menuId)))
      throw new NotFoundException('Menu item not found');
    const { targetId, url } = await this.validateItemTarget(input);
    const row = await this.menus.updateItem(itemId, {
      type: input.type,
      label: input.label,
      targetId,
      url,
      openInNewTab: input.openInNewTab ?? false,
    });
    await this.hooks.emit('menu.changed', {});
    return this.toAdminItem(row, []);
  }

  async deleteItem(menuId: string, itemId: string): Promise<void> {
    if (!(await this.menus.itemExists(itemId, menuId)))
      throw new NotFoundException('Menu item not found');
    await this.menus.deleteItem(itemId);
    await this.hooks.emit('menu.changed', {});
  }

  async applyStructure(menuId: string, input: MenuStructureInput): Promise<void> {
    if (!(await this.menus.exists(menuId))) throw new NotFoundException('Menu not found');
    const owned = new Set(await this.menus.listItemIds(menuId));
    const payloadIds = new Set(input.nodes.map((n) => n.id));
    for (const n of input.nodes) {
      if (!owned.has(n.id))
        throw new BadRequestException(`Item ${n.id} does not belong to this menu`);
      if (n.parentId !== null && !payloadIds.has(n.parentId)) {
        throw new BadRequestException(
          `Parent ${n.parentId} is not part of the submitted structure`,
        );
      }
    }
    this.assertNoCycle(input.nodes);
    await this.menus.applyStructure(menuId, input.nodes);
    await this.hooks.emit('menu.changed', {});
  }

  // --- Translations ----------------------------------------------------------

  async upsertTranslation(
    menuId: string,
    itemId: string,
    locale: string,
    input: MenuItemTranslationInput,
  ): Promise<void> {
    if (!(await this.menus.itemExists(itemId, menuId)))
      throw new NotFoundException('Menu item not found');
    const label = input.label?.trim() ?? '';
    if (label === '') {
      await this.deleteTranslation(menuId, itemId, locale);
      return;
    }
    await this.menus.upsertTranslation(itemId, locale, { label });
    await this.hooks.emit('menu.changed', {});
  }

  async deleteTranslation(menuId: string, itemId: string, locale: string): Promise<void> {
    if (!(await this.menus.itemExists(itemId, menuId)))
      throw new NotFoundException('Menu item not found');
    try {
      await this.menus.deleteTranslation(itemId, locale);
    } catch (e) {
      if (isKnownError(e, 'P2025')) return; // idempotent
      throw e;
    }
    await this.hooks.emit('menu.changed', {});
  }

  // --- Public ----------------------------------------------------------------

  async getPublicMenu(location: string, locale: string): Promise<PublicMenu> {
    const safeLocale = (LOCALES as readonly string[]).includes(locale) ? locale : DEFAULT_LOCALE;
    // Key on the resolved (safe) locale so junk locales share the default's entry.
    return this.cache.getOrSet(cacheKey(CACHE_NS.MENUS, `${location}:${safeLocale}`), () =>
      this.computePublicMenu(location, safeLocale),
    );
  }

  private async computePublicMenu(location: string, safeLocale: string): Promise<PublicMenu> {
    const menu = await this.menus.findByLocation(location);
    if (!menu) return { location, items: [] };

    const slugs = await this.resolveSlugMaps(menu.items);
    const resolved = new Map<string, { item: MenuItemRow; node: MenuNode }>();
    for (const it of menu.items) {
      const slug = it.type === 'CUSTOM' ? null : (slugs[it.type]?.[it.targetId ?? ''] ?? null);
      const url = resolveMenuItemUrl(it.type, slug, it.url);
      if (url === null) continue; // unresolved target → drop
      const tr = it.translations.find((t) => t.locale === safeLocale);
      const label = tr?.label != null && tr.label !== '' ? tr.label : it.label;
      resolved.set(it.id, {
        item: it,
        node: { label, url, openInNewTab: it.openInNewTab, children: [] },
      });
    }

    const roots: MenuNode[] = [];
    for (const { item, node } of resolved.values()) {
      const parent = item.parentId ? resolved.get(item.parentId) : null;
      if (item.parentId && !parent) continue; // parent dropped → drop the orphan too
      if (parent) parent.node.children.push(node);
      else roots.push(node);
    }
    return { location, items: roots };
  }

  // --- Internals -------------------------------------------------------------

  private async validateItemTarget(
    input: CreateMenuItemInput,
  ): Promise<{ targetId: string | null; url: string | null }> {
    if (input.type === 'CUSTOM') {
      const url = input.url ? normalizeCustomUrl(input.url) : null;
      if (url === null)
        throw new BadRequestException('CUSTOM items need a valid http(s) or "/" url');
      return { targetId: null, url };
    }
    const targetId = input.targetId;
    if (!targetId) throw new BadRequestException(`${input.type} items need a targetId`);
    const map = await this.slugsForType(input.type, [targetId]);
    if (!map[targetId])
      throw new BadRequestException(`The referenced ${input.type.toLowerCase()} was not found`);
    return { targetId, url: null };
  }

  private slugsForType(type: MenuItemType, ids: string[]): Promise<Record<string, string>> {
    switch (type) {
      case 'POST':
        return this.posts.slugsByIds(ids);
      case 'PAGE':
        return this.pages.slugsByIds(ids);
      case 'CATEGORY':
        return this.categories.slugsByIds(ids);
      case 'CUSTOM':
        return Promise.resolve({});
    }
  }

  private async resolveSlugMaps(
    items: MenuWithTree['items'],
  ): Promise<Record<string, Record<string, string>>> {
    const idsByType = (t: MenuItemType) =>
      items.filter((i) => i.type === t && i.targetId).map((i) => i.targetId as string);
    const [POST, PAGE, CATEGORY] = await Promise.all([
      this.posts.slugsByIds(idsByType('POST')),
      this.pages.slugsByIds(idsByType('PAGE')),
      this.categories.slugsByIds(idsByType('CATEGORY')),
    ]);
    return { POST, PAGE, CATEGORY };
  }

  private assertNoCycle(nodes: { id: string; parentId: string | null }[]): void {
    const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
    for (const start of parentOf.keys()) {
      const seen = new Set<string>();
      let cur: string | null | undefined = start;
      while (cur != null) {
        if (seen.has(cur)) throw new BadRequestException('Menu structure contains a cycle');
        seen.add(cur);
        cur = parentOf.get(cur) ?? null;
      }
    }
  }

  private toAdminItem(row: MenuItemRow, children: AdminMenuItem[]): AdminMenuItem {
    return {
      id: row.id,
      parentId: row.parentId,
      order: row.order,
      type: row.type,
      label: row.label,
      targetId: row.targetId,
      url: row.url,
      openInNewTab: row.openInNewTab,
      translations: row.translations.map((t) => ({ locale: t.locale, label: t.label })),
      children,
    };
  }

  private toAdminTree(items: MenuWithTree['items']): AdminMenuItem[] {
    const nodes = new Map<string, AdminMenuItem>();
    for (const it of items) nodes.set(it.id, this.toAdminItem(it, []));
    const roots: AdminMenuItem[] = [];
    for (const it of items) {
      const node = nodes.get(it.id);
      if (!node) continue;
      const parent = it.parentId ? nodes.get(it.parentId) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }
}
