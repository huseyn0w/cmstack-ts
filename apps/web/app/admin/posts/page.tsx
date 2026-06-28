import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/admin/api';
import { postListSchema } from '@cmstack-ts/config';
import type { PostList } from '@cmstack-ts/config';
import Link from 'next/link';
import { PostsBulkTable } from './posts-bulk-table';

export const dynamic = 'force-dynamic';

async function fetchPosts(params: {
  status?: string;
  includeTrashed?: boolean;
}): Promise<PostList | null> {
  try {
    const query = new URLSearchParams({ perPage: '50' });
    if (params.status) query.set('status', params.status);
    if (params.includeTrashed) query.set('includeTrashed', 'true');
    return await apiGet(`/posts?${query.toString()}`, postListSchema);
  } catch {
    return null;
  }
}

type Tab = 'all' | 'published' | 'draft' | 'trash';

interface PostsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

function EmptyState({ tab, showNewPost }: { tab: Tab; showNewPost: boolean }) {
  const messages: Record<Tab, string> = {
    all: 'No posts yet.',
    published: 'No published posts.',
    draft: 'No drafts.',
    trash: 'Trash is empty.',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-muted-foreground">{messages[tab]}</p>
      {showNewPost && (
        <Link
          href="/admin/posts/new"
          className="mt-3 text-sm text-primary hover:underline underline-offset-4"
        >
          Create your first post
        </Link>
      )}
    </div>
  );
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const params = await searchParams;
  const rawTab = params.tab ?? 'all';
  const activeTab: Tab = ['all', 'published', 'draft', 'trash'].includes(rawTab)
    ? (rawTab as Tab)
    : 'all';

  const isTrash = activeTab === 'trash';
  const fetchStatus =
    activeTab === 'published' || activeTab === 'draft' ? activeTab.toUpperCase() : undefined;

  const data = await fetchPosts({
    status: fetchStatus,
    includeTrashed: isTrash,
  });

  const posts = data?.items ?? [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'trash', label: 'Trash' },
  ];

  return (
    <div className="px-6 py-10 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your blog posts and articles.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/posts/new">New post</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-border mb-6">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/admin/posts' : `/admin/posts?tab=${tab.key}`}
            className={
              activeTab === tab.key
                ? 'px-3 py-2 text-sm font-medium text-foreground border-b-2 border-primary -mb-px'
                : 'px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150'
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Content or error */}
      {data === null ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load posts right now.</p>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState tab={activeTab} showNewPost={!isTrash} />
      ) : (
        <PostsBulkTable posts={posts} isTrash={isTrash} />
      )}
    </div>
  );
}
