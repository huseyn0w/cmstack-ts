import type { Permission } from '@typress/config';
import { describe, expect, it } from 'vitest';
import { buildAbility } from './ability';

describe('buildAbility', () => {
  it('grants everything for (manage, all)', () => {
    const ability = buildAbility([{ action: 'manage', subject: 'all' }]);
    expect(ability.can('read', 'Admin')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
    expect(ability.can('manage', 'Anything')).toBe(true);
  });

  it('grants only the specific (action, subject) pairs given', () => {
    const perms: Permission[] = [
      { action: 'read', subject: 'Admin' },
      { action: 'manage', subject: 'User' },
    ];
    const ability = buildAbility(perms);
    expect(ability.can('read', 'Admin')).toBe(true);
    expect(ability.can('update', 'User')).toBe(true); // manage implies update
    expect(ability.can('read', 'Role')).toBe(false);
    expect(ability.can('delete', 'Admin')).toBe(false);
  });

  it('grants nothing for an empty permission set', () => {
    const ability = buildAbility([]);
    expect(ability.can('read', 'Admin')).toBe(false);
    expect(ability.can('read', 'all')).toBe(false);
  });
});
