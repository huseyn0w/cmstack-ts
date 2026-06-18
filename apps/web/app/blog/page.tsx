import { getActiveTheme } from '@/themes/active-theme';
import { postListSchema } from '@typress/config';
import { apiBaseUrl } from '../lib/api';

export const dynamic = 'force-dynamic';

const EMPTY = { items: [], total: 0, page: 1, perPage: 20 };

async function getPosts() {
  try {
    const res = await fetch(`${apiBaseUrl}/public/posts?perPage=20`, { cache: 'no-store' });
    if (!res.ok) return EMPTY;
    const parsed = postListSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    // API unreachable — degrade to an empty list rather than erroring the page.
    return EMPTY;
  }
}

export default async function BlogIndexPage() {
  const [{ items }, { Layout, BlogIndex }] = await Promise.all([getPosts(), getActiveTheme()]);

  return (
    <Layout>
      <BlogIndex posts={items} />
    </Layout>
  );
}
