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
import { pageDetailSchema, scheduleLabel } from '@cmstack-ts/config';
import type { PageDetail } from '@cmstack-ts/config';
import Link from 'next/link';
import { z } from 'zod';
import { PageRowActions } from './page-row-actions';

export const dynamic = 'force-dynamic';

const pageListSchema = z.array(pageDetailSchema);

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

type Tab = 'all' | 'published' | 'draft' | 'trash';

async function fetchPages(includeTrashed = false): Promise<PageDetail[] | null> {
  try {
    const query = includeTrashed ? '?includeTrashed=true' : '';
    return await apiGet(`/pages${query}`, pageListSchema);
  } catch {
    return null;
  }
}

interface PagesPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function PagesPage({ searchParams }: PagesPageProps) {
  const params = await searchParams;
  const rawTab = params.tab ?? 'all';
  const activeTab: Tab = ['all', 'published', 'draft', 'trash'].includes(rawTab)
    ? (rawTab as Tab)
    : 'all';

  const isTrash = activeTab === 'trash';
  const allPages = await fetchPages(isTrash);

  const pages =
    allPages === null
      ? null
      : activeTab === 'published'
        ? allPages.filter((p) => p.status === 'PUBLISHED')
        : activeTab === 'draft'
          ? allPages.filter((p) => p.status === 'DRAFT')
          : allPages;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'trash', label: 'Trash' },
  ];

  return (
    <div className="px-6 py-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pages</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your static pages.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/pages/new">New page</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-border mb-6">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/admin/pages' : `/admin/pages?tab=${tab.key}`}
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

      {pages === null ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load pages right now.</p>
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {isTrash ? 'Trash is empty.' : 'No pages yet.'}
          </p>
          {!isTrash && (
            <Link
              href="/admin/pages/new"
              className="mt-3 text-sm text-primary hover:underline underline-offset-4"
            >
              Create your first page
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
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
      )}
    </div>
  );
}
