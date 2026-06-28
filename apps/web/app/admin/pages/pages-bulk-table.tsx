'use client';

import { type BulkPageAction, bulkPagesAction } from '@/app/admin/pages/actions';
import { PageRowActions } from '@/app/admin/pages/page-row-actions';
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
import type { PageDetail } from '@cmstack-ts/config';
import { CheckCircle2, RefreshCw, Trash2, XCircle } from 'lucide-react';
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

const VERB: Record<BulkPageAction, string> = {
  publish: 'published',
  unpublish: 'unpublished',
  trash: 'moved to trash',
  restore: 'restored',
  permanent: 'permanently deleted',
};

export function PagesBulkTable({ pages, isTrash }: { pages: PageDetail[]; isTrash: boolean }) {
  const ids = pages.map((p) => p.id);
  const selection = useRowSelection(ids);
  const [isPending, startTransition] = useTransition();

  function run(action: BulkPageAction) {
    const targetIds = selection.selectedIds;
    startTransition(async () => {
      const result = await bulkPagesAction(targetIds, action);
      if (result.ok) {
        const msg = bulkResultMessage(result.data, VERB[action], 'page');
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
            title: `Delete ${selection.count} page${selection.count === 1 ? '' : 's'} permanently?`,
            description: 'The selected pages will be permanently deleted. This cannot be undone.',
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
            title: `Move ${selection.count} page${selection.count === 1 ? '' : 's'} to trash?`,
            description: 'The selected pages can be restored later from the Trash tab.',
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
              <TableHead>Updated</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow
                key={page.id}
                data-selected={selection.isSelected(page.id) || undefined}
                className="data-[selected]:bg-primary/5"
              >
                <TableCell className="w-10">
                  <RowCheckbox
                    checked={selection.isSelected(page.id)}
                    onToggle={() => selection.toggle(page.id)}
                    label={`Select ${page.title}`}
                    disabled={isPending}
                  />
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate max-w-xs">{page.title}</p>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                      /{page.slug}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const badge = badgeFor(
                      scheduleLabel(page.status, page.scheduledAt, new Date()),
                    );
                    return <Badge variant={badge.variant}>{badge.text}</Badge>;
                  })()}
                </TableCell>
                <TableCell>
                  <time
                    dateTime={page.updatedAt}
                    className="font-mono text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDate(page.updatedAt)}
                  </time>
                </TableCell>
                <TableCell className="text-right">
                  <PageRowActions page={page} isTrash={isTrash} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selection.count > 0 && (
        <BulkBar
          count={selection.count}
          noun="page"
          actions={actions}
          onClear={selection.clear}
          isPending={isPending}
        />
      )}
    </>
  );
}
