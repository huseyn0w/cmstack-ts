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
}

/** Render-region hooks: a named slot on the public site plugins inject HTML into. */
export interface RegionMap {
  /** Appended to the public site footer area. */
  'site.footer': void;
}

export type FilterName = keyof FilterMap;
export type ActionName = keyof ActionMap;
export type RegionName = keyof RegionMap;
