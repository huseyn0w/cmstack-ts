import type { Theme } from '../types';
import { MagazineBlogIndex } from './blog-index';
import { MagazineBlogPost } from './blog-post';
import { MagazineHome } from './home';
import { MagazineLayout } from './layout';

export const magazineTheme: Theme = {
  meta: {
    id: 'magazine',
    label: 'Magazine',
    description: 'Light, serif, masthead-led. A print-newspaper feel.',
  },
  Layout: MagazineLayout,
  Home: MagazineHome,
  BlogIndex: MagazineBlogIndex,
  BlogPost: MagazineBlogPost,
};
