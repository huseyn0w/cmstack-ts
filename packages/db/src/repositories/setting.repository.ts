import type { PrismaClient, Setting } from '@prisma/client';

/**
 * Data access for the key-value `Setting` model. Framework-free (no NestJS); the
 * API binds {@link SETTING_REPOSITORY} to {@link PrismaSettingRepository} via DI.
 */
export interface SettingRepository {
  /** Returns the setting row for `key`, or `null` when it does not exist. */
  get(key: string): Promise<Setting | null>;
  /** Inserts (`{key,value}`) or updates (`{value}`) the setting for `key`. */
  upsert(key: string, value: string): Promise<Setting>;
}

/** DI token for {@link SettingRepository}. */
export const SETTING_REPOSITORY = Symbol('SETTING_REPOSITORY');

export class PrismaSettingRepository implements SettingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  get(key: string): Promise<Setting | null> {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  upsert(key: string, value: string): Promise<Setting> {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
