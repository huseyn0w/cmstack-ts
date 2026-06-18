import { getActiveTheme } from '@/themes/active-theme';
import { postDetailSchema } from '@typress/config';
import { notFound } from 'next/navigation';
import { apiBaseUrl } from '../../lib/api';

export const dynamic = 'force-dynamic';

async function getPost(slug: string) {
  try {
    const res = await fetch(`${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = postDetailSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, { Layout, BlogPost }] = await Promise.all([getPost(slug), getActiveTheme()]);
  if (!post) notFound();

  return (
    <Layout>
      <BlogPost post={post} />
    </Layout>
  );
}
