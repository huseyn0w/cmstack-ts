'use server';

import { apiSend } from '@/lib/admin/api';
import { type BulkSummary, summarizeBulk } from '@/lib/admin/bulk';
import { runBulk } from '@/lib/admin/run-bulk';
import { type CommentStatus, moderateCommentSchema } from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function moderateComment(
  id: string,
  status: CommentStatus,
  postSlug: string,
): Promise<ActionResult> {
  const parsed = moderateCommentSchema.safeParse({ status });
  if (!parsed.success) return { ok: false, error: 'Invalid status.' };
  try {
    await apiSend('PATCH', `/comments/${id}`, parsed.data);
    revalidatePath('/admin/comments');
    // Approving/un-approving changes what the public post shows.
    revalidatePath(`/blog/${postSlug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update comment' };
  }
}

export async function deleteComment(id: string, postSlug: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/comments/${id}`);
    revalidatePath('/admin/comments');
    revalidatePath(`/blog/${postSlug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete comment' };
  }
}

export type BulkCommentAction = 'approve' | 'spam' | 'trash' | 'delete';

const BULK_STATUS: Record<Exclude<BulkCommentAction, 'delete'>, CommentStatus> = {
  approve: 'APPROVED',
  spam: 'SPAM',
  trash: 'TRASH',
};

/** Apply one moderation action to many comments by looping the single-item endpoints. */
export async function bulkCommentsAction(
  ids: string[],
  action: BulkCommentAction,
): Promise<ActionResult<BulkSummary>> {
  if (ids.length === 0) return { ok: false, error: 'No comments selected.' };
  const run =
    action === 'delete'
      ? (id: string) => apiSend('DELETE', `/comments/${id}`)
      : (id: string) => apiSend('PATCH', `/comments/${id}`, { status: BULK_STATUS[action] });
  const results = await runBulk(ids, run);
  revalidatePath('/admin/comments');
  // Approving/spamming/deleting changes what public posts show.
  revalidatePath('/', 'layout');
  return { ok: true, data: summarizeBulk(results) };
}
