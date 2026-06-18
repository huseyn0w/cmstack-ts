'use server';

import { apiSend } from '@/lib/admin/api';
import {
  createFaqSchema,
  createServiceSchema,
  updateFaqSchema,
  updateServiceSchema,
  updateSiteProfileSchema,
} from '@typress/config';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(err: unknown, fallback: string): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : fallback };
}

/** Revalidate the admin screen and the public surfaces SEO/GEO feeds. */
function revalidateSeo(): void {
  revalidatePath('/admin/seo');
  // Public site (metadata, /services, llms.txt, sitemap) reflects the change.
  revalidatePath('/', 'layout');
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = updateSiteProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the profile fields.' };
  try {
    await apiSend('PUT', '/seo/profile', parsed.data);
    revalidateSeo();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to save profile');
  }
}

export async function createService(primary: string, secondary: string): Promise<ActionResult> {
  const parsed = createServiceSchema.safeParse({ name: primary, description: secondary });
  if (!parsed.success) return { ok: false, error: 'A service name is required.' };
  try {
    await apiSend('POST', '/seo/services', parsed.data);
    revalidateSeo();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to add service');
  }
}

export async function updateService(
  id: string,
  primary: string,
  secondary: string,
): Promise<ActionResult> {
  const parsed = updateServiceSchema.safeParse({ name: primary, description: secondary });
  if (!parsed.success) return { ok: false, error: 'A service name is required.' };
  try {
    await apiSend('PATCH', `/seo/services/${id}`, parsed.data);
    revalidateSeo();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to update service');
  }
}

export async function deleteService(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/seo/services/${id}`);
    revalidateSeo();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to delete service');
  }
}

export async function createFaq(primary: string, secondary: string): Promise<ActionResult> {
  const parsed = createFaqSchema.safeParse({ question: primary, answer: secondary });
  if (!parsed.success) return { ok: false, error: 'A question is required.' };
  try {
    await apiSend('POST', '/seo/faqs', parsed.data);
    revalidateSeo();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to add FAQ');
  }
}

export async function updateFaq(
  id: string,
  primary: string,
  secondary: string,
): Promise<ActionResult> {
  const parsed = updateFaqSchema.safeParse({ question: primary, answer: secondary });
  if (!parsed.success) return { ok: false, error: 'A question is required.' };
  try {
    await apiSend('PATCH', `/seo/faqs/${id}`, parsed.data);
    revalidateSeo();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to update FAQ');
  }
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/seo/faqs/${id}`);
    revalidateSeo();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to delete FAQ');
  }
}
