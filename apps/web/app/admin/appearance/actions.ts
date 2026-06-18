'use server';

import { apiSend } from '@/lib/admin/api';
import { updateThemeSettingSchema } from '@typress/config';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function activateTheme(themeId: string): Promise<ActionResult> {
  const parsed = updateThemeSettingSchema.safeParse({ activeTheme: themeId });
  if (!parsed.success) {
    return { ok: false, error: 'Invalid theme.' };
  }

  try {
    await apiSend('PUT', '/settings/theme', parsed.data);
    revalidatePath('/admin/appearance');
    // Re-render every public route so the theme swap is immediately visible.
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to switch theme' };
  }
}
