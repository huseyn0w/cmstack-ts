import type { CmstackTsPlugin } from './plugin.types';
import { readingTimePlugin } from './samples/reading-time.plugin';
import { siteFooterNotePlugin } from './samples/site-footer-note.plugin';

/** Every in-repo plugin the build knows about. Enabled state is runtime (a setting). */
export const availablePlugins: CmstackTsPlugin[] = [readingTimePlugin, siteFooterNotePlugin];
