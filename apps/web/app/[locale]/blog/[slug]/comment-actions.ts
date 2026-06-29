'use server';

import { apiBaseUrl } from '@/app/lib/api';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

async function authed(): Promise<string | null> {
  const session = await auth();
  return session?.accessToken ?? null;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
  } catch {
    // ignore
  }
  return fallback;
}

/** Submit a comment as the signed-in user (attributed; no name/email/recaptcha). */
export async function submitAuthenticatedComment(
  slug: string,
  content: string,
  parentId?: string,
): Promise<ActionResult> {
  const token = await authed();
  if (!token) return { ok: false, error: 'You are not signed in.' };
  try {
    const res = await fetch(`${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}/comments`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content, parentId }),
    });
    if (!res.ok)
      return { ok: false, error: await readError(res, 'Could not submit your comment.') };
    revalidatePath(`/blog/${slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not submit your comment.' };
  }
}

/** Edit your own comment (re-opens moderation). */
export async function editOwnComment(
  slug: string,
  id: string,
  content: string,
): Promise<ActionResult> {
  const token = await authed();
  if (!token) return { ok: false, error: 'You are not signed in.' };
  try {
    const res = await fetch(
      `${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}/comments/${id}`,
      {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      },
    );
    if (!res.ok) return { ok: false, error: await readError(res, 'Could not edit your comment.') };
    revalidatePath(`/blog/${slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not edit your comment.' };
  }
}

/** Delete your own comment. */
export async function deleteOwnComment(slug: string, id: string): Promise<ActionResult> {
  const token = await authed();
  if (!token) return { ok: false, error: 'You are not signed in.' };
  try {
    const res = await fetch(
      `${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}/comments/${id}`,
      {
        method: 'DELETE',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status !== 204)
      return { ok: false, error: await readError(res, 'Could not delete your comment.') };
    revalidatePath(`/blog/${slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete your comment.' };
  }
}
