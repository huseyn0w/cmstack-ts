import type { CmstackTsPlugin } from '../plugin.types';

/**
 * Sample render-region plugin: contributes a fixed, safe footer line to the
 * public `site.footer` region. The markup is a constant shape (no interpolation),
 * so it is safe to render alongside the sanitized region output.
 */
export const siteFooterNotePlugin: CmstackTsPlugin = {
  id: 'site-footer-note',
  name: 'Site footer note',
  description: 'Adds a short "Built with Cmstack-TS" line to the public site footer.',
  register(api) {
    api.addRegion('site.footer', () => '<p class="plugin-footer-note">Built with Cmstack-TS</p>');
  },
};
