import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/admin/api';
import { postListSchema, scheduleLabel } from '@cmstack-ts/config';
import type { PostList, PostSummary } from '@cmstack-ts/config';
import Link from 'next/link';
import { PostRowActions } from './post-row-actions';

export const dynamic = 'force-dynamic';

function badgeFor(label: 'scheduled' | 'published' | 'draft'): {
  variant: 'success' | 'muted' | 'outline';
  text: string;
} {
  if (label === 'published') return { variant: 'success', text: 'Published' };
  if (label === 'scheduled') return { variant: 'outline', text: 'Scheduled' };
  return { variant: 'muted', text: 'Draft' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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

function PostsTable({ posts, isTrash }: { posts: PostSummary[]; isTrash: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Categories</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-12 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => (
          <TableRow key={post.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate max-w-xs">{post.title}</p>
                <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                  /{post.slug}
                </p>
              </div>
            </TableCell>
            <TableCell>
              {(() => {
                const badge = badgeFor(scheduleLabel(post.status, post.scheduledAt, new Date()));
                return <Badge variant={badge.variant}>{badge.text}</Badge>;
              })()}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {post.categories.length > 0 ? (
                  post.categories.map((cat) => (
                    <Badge key={cat.id} variant="outline" className="text-xs">
                      {cat.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <time
                dateTime={post.updatedAt}
                className="font-mono text-xs text-muted-foreground tabular-nums"
              >
                {formatDate(post.updatedAt)}
              </time>
            </TableCell>
            <TableCell className="text-right">
              <PostRowActions post={post} isTrash={isTrash} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <PostsTable posts={posts} isTrash={isTrash} />
        </div>
      )}
    </div>
  );
}
