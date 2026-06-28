'use client';

import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface CheckboxProps {
  checked: boolean;
  /** Tri-state: shows a dash when partially selected (and reports unchecked). */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label': string;
}

/** Minimal accessible checkbox styled to the canon (§5). Tri-state for select-all. */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <span className="relative inline-flex items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[4px] border border-border bg-surface checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-primary-contrast">
        {checked ? (
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
        ) : indeterminate ? (
          <Minus className="h-3 w-3" strokeWidth={3} aria-hidden />
        ) : null}
      </span>
    </span>
  );
}
