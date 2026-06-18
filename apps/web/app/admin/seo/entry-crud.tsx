'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

type ActionResult = { ok: true } | { ok: false; error: string };

interface Item {
  id: string;
  primary: string;
  secondary: string;
}

interface EntryCrudProps {
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  items: Item[];
  onCreate: (primary: string, secondary: string) => Promise<ActionResult>;
  onUpdate: (id: string, primary: string, secondary: string) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}

function EntryRow({
  item,
  primaryLabel,
  secondaryLabel,
  onUpdate,
  onDelete,
}: {
  item: Item;
  primaryLabel: string;
  secondaryLabel: string;
  onUpdate: EntryCrudProps['onUpdate'];
  onDelete: EntryCrudProps['onDelete'];
}) {
  const [primary, setPrimary] = useState(item.primary);
  const [secondary, setSecondary] = useState(item.secondary);
  const [isPending, startTransition] = useTransition();
  const dirty = primary !== item.primary || secondary !== item.secondary;

  function save() {
    startTransition(async () => {
      const res = await onUpdate(item.id, primary, secondary);
      res.ok ? toast.success('Saved') : toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await onDelete(item.id);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
      <Input
        aria-label={primaryLabel}
        value={primary}
        onChange={(e) => setPrimary(e.target.value)}
        className="font-medium"
      />
      <Textarea
        aria-label={secondaryLabel}
        value={secondary}
        onChange={(e) => setSecondary(e.target.value)}
        rows={2}
      />
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={remove}
          disabled={isPending}
          className="text-destructive hover:text-destructive hover:bg-destructive/5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty || isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

export function EntryCrud({
  title,
  description,
  primaryLabel,
  secondaryLabel,
  items,
  onCreate,
  onUpdate,
  onDelete,
}: EntryCrudProps) {
  const [newPrimary, setNewPrimary] = useState('');
  const [newSecondary, setNewSecondary] = useState('');
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!newPrimary.trim()) {
      toast.error(`${primaryLabel} is required.`);
      return;
    }
    startTransition(async () => {
      const res = await onCreate(newPrimary, newSecondary);
      if (res.ok) {
        toast.success('Added');
        setNewPrimary('');
        setNewSecondary('');
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <EntryRow
              key={item.id}
              item={item}
              primaryLabel={primaryLabel}
              secondaryLabel={secondaryLabel}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="rounded-lg border border-dashed border-border p-4 space-y-2.5">
        <Input
          aria-label={`New ${primaryLabel}`}
          placeholder={primaryLabel}
          value={newPrimary}
          onChange={(e) => setNewPrimary(e.target.value)}
        />
        <Textarea
          aria-label={`New ${secondaryLabel}`}
          placeholder={secondaryLabel}
          value={newSecondary}
          onChange={(e) => setNewSecondary(e.target.value)}
          rows={2}
        />
        <Button size="sm" onClick={add} disabled={isPending} className="w-full">
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add {title.replace(/s$/, '')}
        </Button>
      </div>
    </section>
  );
}
