'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

export interface BulkAction {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  /** When set, the action asks for confirmation before running. */
  confirm?: { title: string; description: string; confirmLabel: string };
  onRun: () => void;
}

interface BulkBarProps {
  count: number;
  noun: string;
  actions: BulkAction[];
  onClear: () => void;
  isPending?: boolean;
}

/**
 * Sticky action bar shown when one or more rows are selected. The live region
 * announces the selection count to assistive tech (canon §5 Tables bulk bar).
 */
export function BulkBar({ count, noun, actions, onClear, isPending }: BulkBarProps) {
  const [confirming, setConfirming] = useState<BulkAction | null>(null);

  function handleClick(action: BulkAction) {
    if (action.confirm) {
      setConfirming(action);
    } else {
      action.onRun();
    }
  }

  return (
    <>
      <section
        aria-label="Bulk actions"
        className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-md"
      >
        <p aria-live="polite" className="font-mono text-xs text-muted-foreground tabular-nums">
          {count} {noun}
          {count === 1 ? '' : 's'} selected
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <Button
              key={action.key}
              size="sm"
              variant={action.destructive ? 'destructive' : 'outline'}
              disabled={isPending}
              onClick={() => handleClick(action)}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            disabled={isPending}
            onClick={onClear}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirming?.confirm?.title}</DialogTitle>
            <DialogDescription>{confirming?.confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={confirming?.destructive ? 'destructive' : 'default'}
              size="sm"
              disabled={isPending}
              onClick={() => {
                const action = confirming;
                setConfirming(null);
                action?.onRun();
              }}
            >
              {confirming?.confirm?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
