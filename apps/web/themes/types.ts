import type { PostDetail, PostSummary } from '@typress/config';
import type { ComponentType, ReactNode } from 'react';

/**
 * Theme contract (Phase 5). A theme is a swappable set of templates for the
 * public, server-rendered site, resolved at runtime from the `activeTheme`
 * setting. Each theme supplies a chrome `Layout` plus one component per public
 * surface. Themes own their own visual tokens (scoped public CSS vars) and must
 * not reach into the admin token system.
 */

export interface ThemeMeta {
  /** Stable, slug-shaped id stored in the `activeTheme` setting. */
  id: string;
  /** Human label shown in the admin Appearance screen. */
  label: string;
  /** One-line description for the admin Appearance screen. */
  description: string;
}

export interface Theme {
  meta: ThemeMeta;
  /** Page chrome (header/footer + themed wrapper) wrapping every surface. */
  Layout: ComponentType<{ children: ReactNode }>;
  /** Home surface (`/`). */
  Home: ComponentType;
  /** Blog index surface (`/blog`). */
  BlogIndex: ComponentType<{ posts: PostSummary[] }>;
  /** Single post surface (`/blog/[slug]`). */
  BlogPost: ComponentType<{ post: PostDetail }>;
}
