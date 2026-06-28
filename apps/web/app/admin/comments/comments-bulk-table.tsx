'use client';

import { type BulkCommentAction, bulkCommentsAction } from '@/app/admin/comments/actions';
import { CommentRowActions } from '@/app/admin/comments/comment-row-actions';
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
import type { AdminComment, CommentStatus } from '@cmstack-ts/config';
import { Check, ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';

const STATUS_VARIANT: Record<CommentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'default',
  APPROVED: 'secondary',
  SPAM: 'destructive',
  TRASH: 'outline',
};

const VERB: Record<BulkCommentAction, string> = {
  approve: 'approved',
  spam: 'marked as spam',
  trash: 'moved to trash',
  delete: 'deleted',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CommentsBulkTable({ comments }: { comments: AdminComment[] }) {
  const ids = comments.map((c) => c.id);
  const selection = useRowSelection(ids);
  const [isPending, startTransition] = useTransition();

  function run(action: BulkCommentAction) {
    const targetIds = selection.selectedIds;
    startTransition(async () => {
      const result = await bulkCommentsAction(targetIds, action);
      if (result.ok) {
        const msg = bulkResultMessage(result.data, VERB[action], 'comment');
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

  const actions: BulkAction[] = [
    {
      key: 'approve',
      label: 'Approve',
      icon: <Check className="h-3.5 w-3.5" />,
      onRun: () => run('approve'),
    },
    {
      key: 'spam',
      label: 'Spam',
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      onRun: () => run('spam'),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      destructive: true,
      confirm: {
        title: `Delete ${selection.count} comment${selection.count === 1 ? '' : 's'}?`,
        description: 'The selected comments will be permanently deleted. This cannot be undone.',
        confirmLabel: 'Delete',
      },
      onRun: () => run('delete'),
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
              <TableHead>Author</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Post</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comments.map((comment) => (
              <TableRow
                key={comment.id}
                data-selected={selection.isSelected(comment.id) || undefined}
                className="data-[selected]:bg-primary/5"
              >
                <TableCell className="w-10 align-top">
                  <RowCheckbox
                    checked={selection.isSelected(comment.id)}
                    onToggle={() => selection.toggle(comment.id)}
                    label={`Select comment by ${comment.authorName}`}
                    disabled={isPending}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <div className="text-sm font-medium text-foreground">{comment.authorName}</div>
                  <div className="text-xs text-muted-foreground">{comment.authorEmail}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDate(comment.createdAt)}
                  </div>
                </TableCell>
                <TableCell className="align-top max-w-sm">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                  {comment.parentId && (
                    <span className="text-[10px] text-muted-foreground">↳ reply</span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Link
                    href={`/blog/${comment.postSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {comment.postTitle}
                  </Link>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={STATUS_VARIANT[comment.status]}>
                    {comment.status.charAt(0) + comment.status.slice(1).toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="align-top text-right">
                  <CommentRowActions comment={comment} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selection.count > 0 && (
        <BulkBar
          count={selection.count}
          noun="comment"
          actions={actions}
          onClear={selection.clear}
          isPending={isPending}
        />
      )}
    </>
  );
}
