import { getSeoContent } from '@/lib/seo/fetch';
import { JsonLd } from '@/lib/seo/json-ld';
import { blogPostingJsonLd } from '@/lib/seo/jsonld';
import { siteUrl } from '@/lib/seo/site';
import { getActiveTheme } from '@/themes/active-theme';
import { postDetailSchema } from '@typress/config';
import type { Metadata } from 'next';
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? undefined,
      url: `${siteUrl}/blog/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, { Layout, BlogPost }, { profile }] = await Promise.all([
    getPost(slug),
    getActiveTheme(),
    getSeoContent(),
  ]);
  if (!post) notFound();

  return (
    <>
      <JsonLd
        data={blogPostingJsonLd(
          {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            publishedAt: post.publishedAt,
            authorName: post.author?.name ?? null,
          },
          profile,
          siteUrl,
        )}
      />
      <Layout>
        <BlogPost post={post} />
      </Layout>
    </>
  );
}
