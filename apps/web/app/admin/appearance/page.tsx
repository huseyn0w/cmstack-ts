import { apiGet } from '@/lib/admin/api';
import { canManageSettings, requireAdminSession } from '@/lib/admin/guard';
import { DEFAULT_THEME_ID, themeCatalog } from '@/themes/registry';
import { themeSettingSchema } from '@typress/config';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ThemePicker } from './theme-picker';

export const dynamic = 'force-dynamic';

async function fetchActiveTheme(): Promise<string> {
  try {
    const { activeTheme } = await apiGet('/settings/theme', themeSettingSchema);
    return activeTheme;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export default async function AppearancePage() {
  const session = await requireAdminSession();
  // Appearance (theme switching) is Administrator-only; Editors don't hold it.
  if (!canManageSettings(session)) {
    redirect('/admin');
  }

  const activeThemeId = await fetchActiveTheme();

  return (
    <div className="px-6 py-10 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Appearance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the theme your public site renders through. Changes are live immediately.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View site
        </Link>
      </div>

      <ThemePicker themes={themeCatalog} activeThemeId={activeThemeId} />
    </div>
  );
}
