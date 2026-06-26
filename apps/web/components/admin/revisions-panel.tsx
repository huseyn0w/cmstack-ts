'use client';

import { Button } from '@/components/ui/button';
import {
  type FieldCompare,
  type RevisionField,
  type RevisionView,
  compareRevisionFields,
} from '@/lib/admin/revision-compare';
import { cn } from '@/lib/utils';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface RevisionsPanelProps {
  id: string;
  current: Record<string, unknown>;
  revisions: RevisionView[];
  fields: RevisionField[];
  restoreAction: (
    id: string,
    revisionId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

function truncate(value: string, max = 400): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function RevisionsPanel({
  id,
  current,
  revisions,
  fields,
  restoreAction,
}: RevisionsPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (revisions.length === 0) {
    return (
      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold">Revisions</h2>
        <p className="mt-2 text-sm text-muted-foreground">No revisions yet.</p>
      </section>
    );
  }

  const active = revisions.find((r) => r.id === selected) ?? null;
  const diff: FieldCompare[] = active
    ? compareRevisionFields(current, active.snapshot, fields)
    : [];

  function onRestore(revisionId: string) {
    startTransition(async () => {
      const result = await restoreAction(id, revisionId);
      if (result.ok) toast.success('Revision restored');
      else toast.error(result.error);
    });
  }

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="text-lg font-semibold">Revisions</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Restoring saves the current version as a new revision first, so it is reversible.
      </p>
      <ul className="mt-4 divide-y rounded-md border">
        {revisions.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 p-3">
            <button
              type="button"
              className="text-left text-sm hover:underline"
              onClick={() => setSelected(r.id === selected ? null : r.id)}
            >
              {new Date(r.createdAt).toLocaleString()} · {r.authorId ?? 'unknown'}
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onRestore(r.id)}
            >
              Restore
            </Button>
          </li>
        ))}
      </ul>
      {active && (
        <div className="mt-4 space-y-3">
          {diff.map((f) => (
            <div key={f.key} className="rounded-md border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {f.label} {f.changed ? '· changed' : ''}
              </p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">Current</p>
                  <p className={cn('text-sm', f.changed && 'bg-destructive/10')}>
                    {truncate(f.current)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Revision</p>
                  <p className={cn('text-sm', f.changed && 'bg-primary/10')}>
                    {truncate(f.revision)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
