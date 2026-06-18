import type { Theme } from '../types';
import { EditorialBlogIndex } from './blog-index';
import { EditorialBlogPost } from './blog-post';
import { EditorialHome } from './home';
import { EditorialLayout } from './layout';

export const editorialTheme: Theme = {
  meta: {
    id: 'editorial',
    label: 'Editorial',
    description: 'Dark, restrained, typography-led. The default Typress look.',
  },
  Layout: EditorialLayout,
  Home: EditorialHome,
  BlogIndex: EditorialBlogIndex,
  BlogPost: EditorialBlogPost,
};
