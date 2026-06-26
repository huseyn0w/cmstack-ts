'use server';

import { apiSend } from '@/lib/admin/api';
import {
  type CreatePageInput,
  type UpdatePageInput,
  pageTranslationInputSchema,
} from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function createPageAction(
  input: CreatePageInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const page = (await apiSend('POST', '/pages', input)) as { id: string };
    revalidatePath('/admin/pages');
    return { ok: true, data: page };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create page' };
  }
}

export async function updatePageAction(id: string, input: UpdatePageInput): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/pages/${id}`, input);
    revalidatePath('/admin/pages');
    revalidatePath(`/admin/pages/${id}/edit`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update page' };
  }
}

export async function deletePageAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/pages/${id}`);
    revalidatePath('/admin/pages');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete page' };
  }
}

export async function restorePageAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('POST', `/pages/${id}/restore`);
    revalidatePath('/admin/pages');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to restore page' };
  }
}

export async function restorePageRevisionAction(
  id: string,
  revisionId: string,
): Promise<ActionResult> {
  try {
    await apiSend('POST', `/pages/${id}/revisions/${revisionId}/restore`);
    revalidatePath('/admin/pages');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to restore revision' };
  }
}

export async function permanentDeletePageAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/pages/${id}/permanent`);
    revalidatePath('/admin/pages');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to permanently delete page',
    };
  }
}

export async function upsertPageTranslationAction(
  id: string,
  locale: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = pageTranslationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the translation fields.' };
  try {
    await apiSend('PUT', `/pages/${id}/translations/${locale}`, parsed.data);
    revalidatePath('/admin/pages');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save translation' };
  }
}

export async function deletePageTranslationAction(
  id: string,
  locale: string,
): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/pages/${id}/translations/${locale}`);
    revalidatePath('/admin/pages');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to clear translation' };
  }
}
