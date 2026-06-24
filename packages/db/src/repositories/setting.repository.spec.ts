import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaSettingRepository } from './setting.repository';

function makeRepo() {
  const setting = { findUnique: vi.fn(), upsert: vi.fn() };
  const prisma = { setting } as unknown as PrismaClient;
  return { repo: new PrismaSettingRepository(prisma), setting };
}

describe('PrismaSettingRepository', () => {
  it('get() looks a setting up by its key', async () => {
    const { repo, setting } = makeRepo();
    const row = { key: 'activeTheme', value: 'magazine' };
    setting.findUnique.mockResolvedValue(row);

    const result = await repo.get('activeTheme');

    expect(setting.findUnique).toHaveBeenCalledWith({ where: { key: 'activeTheme' } });
    expect(result).toBe(row);
  });

  it('get() returns null when the key is absent (no default applied at this layer)', async () => {
    const { repo, setting } = makeRepo();
    setting.findUnique.mockResolvedValue(null);

    expect(await repo.get('activeTheme')).toBeNull();
  });

  it('upsert() preserves the asymmetric create {key,value} vs update {value} branches', async () => {
    const { repo, setting } = makeRepo();
    const row = { key: 'activeTheme', value: 'editorial' };
    setting.upsert.mockResolvedValue(row);

    const result = await repo.upsert('activeTheme', 'editorial');

    expect(setting.upsert).toHaveBeenCalledWith({
      where: { key: 'activeTheme' },
      create: { key: 'activeTheme', value: 'editorial' },
      update: { value: 'editorial' },
    });
    expect(result).toBe(row);
  });
});
