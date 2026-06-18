'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ThemeMeta } from '@/themes/types';
import { Check, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { activateTheme } from './actions';

/** Cosmetic swatches for the preview tile, keyed by theme id. */
const PREVIEWS: Record<string, { bg: string; fg: string; accent: string }> = {
  editorial: { bg: '#0b0b0c', fg: '#f5f5f4', accent: '#e8c372' },
  magazine: { bg: '#f7f4ec', fg: '#1b1a17', accent: '#9e3b2e' },
};

const FALLBACK_PREVIEW = { bg: '#1c1917', fg: '#faf9f7', accent: '#b8862f' };

interface ThemePickerProps {
  themes: ThemeMeta[];
  activeThemeId: string;
}

export function ThemePicker({ themes, activeThemeId }: ThemePickerProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleActivate(themeId: string) {
    setPendingId(themeId);
    startTransition(async () => {
      const result = await activateTheme(themeId);
      if (result.ok) {
        toast.success('Theme activated');
      } else {
        toast.error(result.error);
      }
      setPendingId(null);
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {themes.map((theme) => {
        const isActive = theme.id === activeThemeId;
        const preview = PREVIEWS[theme.id] ?? FALLBACK_PREVIEW;
        const busy = isPending && pendingId === theme.id;

        return (
          <Card key={theme.id} className="overflow-hidden">
            {/* Preview tile */}
            <div
              className="h-28 flex items-center justify-center border-b border-border"
              style={{ background: preview.bg, color: preview.fg }}
            >
              <span className="text-lg font-semibold tracking-tight">Aa</span>
              <span
                className="ml-2 inline-block h-3 w-3 rounded-full"
                style={{ background: preview.accent }}
                aria-hidden
              />
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-sm font-semibold text-foreground">{theme.label}</h2>
                {isActive && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {theme.description}
              </p>
              <Button
                size="sm"
                variant={isActive ? 'outline' : 'default'}
                disabled={isActive || isPending}
                onClick={() => handleActivate(theme.id)}
                className="w-full"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isActive ? 'Current theme' : 'Activate'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
