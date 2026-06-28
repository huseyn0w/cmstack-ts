import { apiGet } from '@/lib/admin/api';
import { canModerateComments, requireAdminSession } from '@/lib/admin/guard';
import {
  type AdminCommentList,
  type CommentStatus,
  adminCommentListSchema,
} from '@cmstack-ts/config';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CommentsBulkTable } from './comments-bulk-table';

export const dynamic = 'force-dynamic';

const STATUSES: (CommentStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'SPAM', 'TRASH', 'ALL'];

async function fetchComments(status: string): Promise<AdminCommentList | null> {
  try {
    const query = new URLSearchParams({ perPage: '50' });
    if (status !== 'ALL') query.set('status', status);
    return await apiGet(`/comments?${query.toString()}`, adminCommentListSchema);
  } catch {
    return null;
  }
}

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireAdminSession();
  if (!canModerateComments(session)) {
    redirect('/admin');
  }

  const params = await searchParams;
  const active = STATUSES.includes((params.status ?? 'PENDING') as CommentStatus | 'ALL')
    ? (params.status ?? 'PENDING')
    : 'PENDING';
  const data = await fetchComments(active);

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Moderate reader comments. New comments wait here until you approve them.
        </p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/comments?status=${s}`}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      {data === null ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load comments right now.</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No comments in this view.</p>
        </div>
      ) : (
        <CommentsBulkTable comments={data.items} />
      )}
    </div>
  );
}
