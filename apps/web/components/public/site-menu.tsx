import { apiBaseUrl } from '@/app/lib/api';
import { Link } from '@/i18n/navigation';
import type { MenuNode, PublicMenu } from '@cmstack-ts/config';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

async function fetchMenu(location: string, locale: string): Promise<PublicMenu | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl}/public/menus/${encodeURIComponent(location)}?locale=${encodeURIComponent(locale)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicMenu;
  } catch {
    return null;
  }
}

/** A site-relative path uses the locale-aware Link; an absolute url is an external anchor. */
function MenuLink({ node, children }: { node: MenuNode; children: ReactNode }) {
  const isInternal = node.url.startsWith('/') && !node.url.startsWith('//');
  if (isInternal) {
    return (
      <Link
        href={node.url}
        className="ts-menu-link"
        {...(node.openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={node.url}
      className="ts-menu-link"
      {...(node.openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

function renderNodes(nodes: MenuNode[], depth: number): ReactNode {
  return nodes.map((n, i) => (
    <li key={`${n.url}-${i}`} className="ts-menu-item">
      <MenuLink node={n}>{n.label}</MenuLink>
      {n.children.length > 0 && (
        <ul className={depth === 0 ? 'ts-menu-sub' : 'ts-menu-sub-nested'}>
          {renderNodes(n.children, depth + 1)}
        </ul>
      )}
    </li>
  ));
}

/**
 * Server-rendered managed navigation for a theme location. Fetches the resolved,
 * localized menu tree from the API and renders it (labels as escaped text, locale
 * -aware internal links, nested dropdowns). On an empty/unavailable menu it
 * renders the theme's `fallback` so the site always has navigation.
 */
export async function SiteMenu({
  location,
  fallback,
}: {
  location: string;
  fallback: ReactNode;
}) {
  const locale = await getLocale();
  const menu = await fetchMenu(location, locale);
  if (!menu || menu.items.length === 0) return <>{fallback}</>;
  return <ul className="ts-menu">{renderNodes(menu.items, 0)}</ul>;
}
