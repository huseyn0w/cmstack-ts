'use client';

import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildTranslationInput, localeLabel } from '@/lib/admin/translation-input';
import { cn } from '@/lib/utils';
import { DEFAULT_LOCALE, LOCALES } from '@cmstack-ts/config';
import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

type ActionResult = { ok: true } | { ok: false; error: string };

export interface TranslationField {
  key: 'title' | 'excerpt' | 'content' | 'metaTitle' | 'metaDescription';
  label: string;
  type: 'input' | 'textarea' | 'richtext';
}

export interface TranslationRow {
  locale: string;
  title: string | null;
  excerpt?: string | null;
  content: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

interface TranslationsPanelProps {
  entityId: string;
  base: Record<string, string>;
  translations: TranslationRow[];
  fields: TranslationField[];
  upsertAction: (
    id: string,
    locale: string,
    input: Record<string, string>,
  ) => Promise<ActionResult>;
  deleteAction: (id: string, locale: string) => Promise<ActionResult>;
}

const OVERRIDE_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

function rowValues(
  row: TranslationRow | undefined,
  fields: TranslationField[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (row as Record<string, string | null | undefined> | undefined)?.[f.key];
    out[f.key] = v ?? '';
  }
  return out;
}

export function TranslationsPanel({
  entityId,
  base,
  translations,
  fields,
  upsertAction,
  deleteAction,
}: TranslationsPanelProps) {
  const [active, setActive] = useState(OVERRIDE_LOCALES[0] ?? DEFAULT_LOCALE);
  // Per-locale editable field values, seeded from existing rows.
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const seed: Record<string, Record<string, string>> = {};
    for (const locale of OVERRIDE_LOCALES) {
      seed[locale] = rowValues(
        translations.find((t) => t.locale === locale),
        fields,
      );
    }
    return seed;
  });
  const [isPending, startTransition] = useTransition();

  if (OVERRIDE_LOCALES.length === 0) return null;

  const current = values[active] ?? {};
  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [active]: { ...prev[active], [key]: value } }));
  }

  function save() {
    const input = buildTranslationInput(
      fields.map((f) => f.key),
      current,
    );
    startTransition(async () => {
      const res = await upsertAction(entityId, active, input);
      if (res.ok) {
        toast.success(`Translation saved (${active})`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function clear() {
    startTransition(async () => {
      const res = await deleteAction(entityId, active);
      if (res.ok) {
        setValues((prev) => ({
          ...prev,
          [active]: Object.fromEntries(fields.map((f) => [f.key, ''])),
        }));
        toast.success(`Translation cleared (${active})`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="max-w-3xl mx-auto px-6 pb-10 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Translations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Per-locale overrides. Leave a field blank to fall back to the default-language value.
        </p>
      </div>

      {/* Locale tab strip */}
      <div className="flex gap-1 border-b border-border" role="tablist">
        {OVERRIDE_LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={active === locale}
            onClick={() => setActive(locale)}
            className={cn(
              'px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
              active === locale
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {localeLabel(locale)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`tr-${active}-${field.key}`}>{field.label}</Label>
            {field.type === 'richtext' ? (
              <RichTextEditor
                value={current[field.key] ?? ''}
                onChange={(v) => setField(field.key, v)}
                placeholder={base[field.key] || 'Falls back to the default language'}
              />
            ) : field.type === 'textarea' ? (
              <Textarea
                id={`tr-${active}-${field.key}`}
                value={current[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={base[field.key] || 'Falls back to the default language'}
                rows={3}
              />
            ) : (
              <Input
                id={`tr-${active}-${field.key}`}
                value={current[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={base[field.key] || 'Falls back to the default language'}
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button size="sm" disabled={isPending} onClick={save}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save {active} translation
          </Button>
          <Button variant="outline" size="sm" disabled={isPending} onClick={clear}>
            Clear {active} translation
          </Button>
        </div>
      </div>
    </section>
  );
}
