'use server';

import { apiSend } from '@/lib/admin/api';
import { type BulkSummary, summarizeBulk } from '@/lib/admin/bulk';
import { runBulk } from '@/lib/admin/run-bulk';
import {
  type CreatePostInput,
  type UpdatePostInput,
  postTranslationInputSchema,
} from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function createPostAction(
  input: CreatePostInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const post = (await apiSend('POST', '/posts', input)) as { id: string };
    revalidatePath('/admin/posts');
    return { ok: true, data: post };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create post' };
  }
}

export async function updatePostAction(id: string, input: UpdatePostInput): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/posts/${id}`, input);
    revalidatePath('/admin/posts');
    revalidatePath(`/admin/posts/${id}/edit`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update post' };
  }
}

export async function deletePostAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/posts/${id}`);
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete post' };
  }
}

export async function restorePostAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('POST', `/posts/${id}/restore`);
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to restore post' };
  }
}

export async function restorePostRevisionAction(
  id: string,
  revisionId: string,
): Promise<ActionResult> {
  try {
    await apiSend('POST', `/posts/${id}/revisions/${revisionId}/restore`);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to restore revision' };
  }
}

export async function permanentDeletePostAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/posts/${id}/permanent`);
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to permanently delete post',
    };
  }
}

export async function togglePostStatusAction(
  id: string,
  currentStatus: string,
): Promise<ActionResult> {
  try {
    const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    await apiSend('PATCH', `/posts/${id}`, { status: newStatus });
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update status' };
  }
}

export type BulkPostAction = 'publish' | 'unpublish' | 'trash' | 'restore' | 'permanent';

/** Apply one action to many posts by looping the single-item endpoints. */
export async function bulkPostsAction(
  ids: string[],
  action: BulkPostAction,
): Promise<ActionResult<BulkSummary>> {
  if (ids.length === 0) return { ok: false, error: 'No posts selected.' };
  const runners: Record<BulkPostAction, (id: string) => Promise<unknown>> = {
    publish: (id) => apiSend('PATCH', `/posts/${id}`, { status: 'PUBLISHED' }),
    unpublish: (id) => apiSend('PATCH', `/posts/${id}`, { status: 'DRAFT' }),
    trash: (id) => apiSend('DELETE', `/posts/${id}`),
    restore: (id) => apiSend('POST', `/posts/${id}/restore`),
    permanent: (id) => apiSend('DELETE', `/posts/${id}/permanent`),
  };
  const results = await runBulk(ids, runners[action]);
  revalidatePath('/admin/posts');
  revalidatePath('/', 'layout');
  return { ok: true, data: summarizeBulk(results) };
}

export async function upsertPostTranslationAction(
  id: string,
  locale: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = postTranslationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the translation fields.' };
  try {
    await apiSend('PUT', `/posts/${id}/translations/${locale}`, parsed.data);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save translation' };
  }
}

export async function deletePostTranslationAction(
  id: string,
  locale: string,
): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/posts/${id}/translations/${locale}`);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to clear translation' };
  }
}
