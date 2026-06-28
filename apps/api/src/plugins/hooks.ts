import type { PostDetail } from '@cmstack-ts/config';

/**
 * Typed hook catalogue. The plugin system exposes a fixed set of extension
 * points (not arbitrary code injection): plugins may only register handlers for
 * the hooks declared here, and their payload/return types are checked.
 *
 * - **Filters** transform a value and return it (the value threads through every
 *   registered handler in priority order).
 * - **Actions** are fire-and-forget events; handlers observe but don't return.
 */

/** Filter hooks: `name -> value type` (handler receives and returns this type). */
export interface FilterMap {
  /** The public post detail, just before it is returned to the site. */
  'public.post.render': PostDetail;
}

/** Action hooks: `name -> payload type`. */
export interface ActionMap {
  /**
   * Fired each time a post transitions *into* PUBLISHED (first publish and any
   * later republish), not only the first time — mirrors a typical CMS
   * post-status transition hook. Listeners that must run once should dedupe.
   */
  'post.published': { id: string; slug: string; title: string };
  /**
   * Fired after a contact-form submission is stored. The contact module's mail
   * listener sends the notification email; fault-isolated, so a mail failure
   * never fails the public submit.
   */
  'contact.submitted': {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
  };
  /**
   * Fired after a new (PENDING) comment is stored from the public site. The
   * comments module's mail listener notifies the moderator; fault-isolated, so a
   * mail failure never fails the public submit. Carries no author email (PII).
   */
  'comment.submitted': {
    id: string;
    postSlug: string;
    postTitle: string;
    authorName: string;
    content: string;
  };
  /**
   * Fired after any write to a post or page (create/update/delete/restore/
   * publish/translation). The caching layer flushes the matching content
   * namespace. `slug` is best-effort (absent on delete-by-id paths).
   */
  'content.changed': { type: 'post' | 'page'; id: string; slug?: string };
  /** Fired after the active theme changes. Flushes the settings cache. */
  'settings.theme.changed': Record<string, never>;
  /** Fired after any menu/item/structure/translation write. Flushes the menu cache. */
  'menu.changed': { location?: string };
  /** Fired after any SEO profile/service/FAQ write. Flushes the SEO cache. */
  'seo.changed': Record<string, never>;
}

/**
 * Render-region hooks: a named slot on the public site plugins inject HTML into.
 * The value type is an unused marker — only the keys (region names) matter.
 */
export interface RegionMap {
  /** Appended to the public site footer area. */
  'site.footer': true;
}

export type FilterName = keyof FilterMap;
export type ActionName = keyof ActionMap;
export type RegionName = keyof RegionMap;
