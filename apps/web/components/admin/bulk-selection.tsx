'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { headerSelectionState, toggleSelection } from '@/lib/admin/bulk';
import { useCallback, useMemo, useState } from 'react';

/** Selection state + handlers shared by every bulk-enabled admin table. */
export function useRowSelection(allIds: readonly string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  // Drop ids that no longer exist (e.g. after a revalidate removed rows).
  const validSelected = useMemo(() => {
    const present = new Set(allIds);
    const next = new Set<string>();
    for (const id of selected) if (present.has(id)) next.add(id);
    return next;
  }, [selected, allIds]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => toggleSelection(prev, id));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size >= allIds.length ? new Set() : new Set(allIds)));
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    selectedIds: [...validSelected],
    count: validSelected.size,
    isSelected: (id: string) => validSelected.has(id),
    headerState: headerSelectionState(validSelected.size, allIds.length),
    toggle,
    toggleAll,
    clear,
  };
}

export function SelectAllCheckbox({
  state,
  onToggle,
  disabled,
}: {
  state: 'all' | 'some' | 'none';
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      checked={state === 'all'}
      indeterminate={state === 'some'}
      onChange={onToggle}
      disabled={disabled}
      aria-label="Select all rows"
    />
  );
}

export function RowCheckbox({
  checked,
  onToggle,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return <Checkbox checked={checked} onChange={onToggle} disabled={disabled} aria-label={label} />;
}
