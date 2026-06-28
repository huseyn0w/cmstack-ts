'use client';

import { type BulkPostAction, bulkPostsAction } from '@/app/admin/posts/actions';
import { PostRowActions } from '@/app/admin/posts/post-row-actions';
import { type BulkAction, BulkBar } from '@/components/admin/bulk-bar';
import { RowCheckbox, SelectAllCheckbox, useRowSelection } from '@/components/admin/bulk-selection';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { bulkResultMessage } from '@/lib/admin/bulk';
import { scheduleLabel } from '@cmstack-ts/config';
import type { PostSummary } from '@cmstack-ts/config';
import { CheckCircle2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';

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

const VERB: Record<BulkPostAction, string> = {
  publish: 'published',
  unpublish: 'unpublished',
  trash: 'moved to trash',
  restore: 'restored',
  permanent: 'permanently deleted',
};

export function PostsBulkTable({ posts, isTrash }: { posts: PostSummary[]; isTrash: boolean }) {
  const ids = posts.map((p) => p.id);
  const selection = useRowSelection(ids);
  const [isPending, startTransition] = useTransition();

  function run(action: BulkPostAction) {
    const targetIds = selection.selectedIds;
    startTransition(async () => {
      const result = await bulkPostsAction(targetIds, action);
      if (result.ok) {
        const msg = bulkResultMessage(result.data, VERB[action], 'post');
        if (result.data.failed > 0) {
          toast.error(result.data.firstError ? `${msg}: ${result.data.firstError}` : msg);
        } else {
          toast.success(msg);
        }
        selection.clear();
      } else {
        toast.error(result.error);
      }
    });
  }

  const actions: BulkAction[] = isTrash
    ? [
        {
          key: 'restore',
          label: 'Restore',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          onRun: () => run('restore'),
        },
        {
          key: 'permanent',
          label: 'Delete permanently',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          destructive: true,
          confirm: {
            title: `Delete ${selection.count} post${selection.count === 1 ? '' : 's'} permanently?`,
            description: 'The selected posts will be permanently deleted. This cannot be undone.',
            confirmLabel: 'Delete permanently',
          },
          onRun: () => run('permanent'),
        },
      ]
    : [
        {
          key: 'publish',
          label: 'Publish',
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          onRun: () => run('publish'),
        },
        {
          key: 'unpublish',
          label: 'Unpublish',
          icon: <XCircle className="h-3.5 w-3.5" />,
          onRun: () => run('unpublish'),
        },
        {
          key: 'trash',
          label: 'Move to trash',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          destructive: true,
          confirm: {
            title: `Move ${selection.count} post${selection.count === 1 ? '' : 's'} to trash?`,
            description: 'The selected posts can be restored later from the Trash tab.',
            confirmLabel: 'Move to trash',
          },
          onRun: () => run('trash'),
        },
      ];

  return (
    <>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <SelectAllCheckbox
                  state={selection.headerState}
                  onToggle={selection.toggleAll}
                  disabled={isPending}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow
                key={post.id}
                data-selected={selection.isSelected(post.id) || undefined}
                className="data-[selected]:bg-primary/5"
              >
                <TableCell className="w-10">
                  <RowCheckbox
                    checked={selection.isSelected(post.id)}
                    onToggle={() => selection.toggle(post.id)}
                    label={`Select ${post.title}`}
                    disabled={isPending}
                  />
                </TableCell>
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
                    const badge = badgeFor(
                      scheduleLabel(post.status, post.scheduledAt, new Date()),
                    );
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
      </div>

      {selection.count > 0 && (
        <BulkBar
          count={selection.count}
          noun="post"
          actions={actions}
          onClear={selection.clear}
          isPending={isPending}
        />
      )}
    </>
  );
}
