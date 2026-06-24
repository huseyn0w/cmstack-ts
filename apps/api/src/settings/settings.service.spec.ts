import { ACTIVE_THEME_KEY } from '@cmstack-ts/config';
import type { Setting, SettingRepository } from '@cmstack-ts/db';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACTIVE_THEME, SettingsService } from './settings.service';

function makeService(get: Setting | null) {
  const repo: SettingRepository = {
    get: vi.fn().mockResolvedValue(get),
    upsert: vi.fn(async (key: string, value: string) => ({ key, value }) as Setting),
  };
  return { service: new SettingsService(repo), repo };
}

describe('SettingsService', () => {
  it('falls back to the default theme when no setting row exists', async () => {
    const { service, repo } = makeService(null);
    expect(await service.getActiveTheme()).toEqual({ activeTheme: DEFAULT_ACTIVE_THEME });
    expect(repo.get).toHaveBeenCalledWith(ACTIVE_THEME_KEY);
  });

  it('returns the stored value when the setting exists', async () => {
    const { service } = makeService({ key: ACTIVE_THEME_KEY, value: 'magazine' } as Setting);
    expect(await service.getActiveTheme()).toEqual({ activeTheme: 'magazine' });
  });

  it('upserts the active theme under the canonical key and echoes the value', async () => {
    const { service, repo } = makeService(null);
    const result = await service.setActiveTheme({ activeTheme: 'editorial' });
    expect(repo.upsert).toHaveBeenCalledWith(ACTIVE_THEME_KEY, 'editorial');
    expect(result).toEqual({ activeTheme: 'editorial' });
  });
});
