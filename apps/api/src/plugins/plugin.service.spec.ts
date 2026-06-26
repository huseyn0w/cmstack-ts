import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookRegistry } from './hook-registry';
import { PluginService } from './plugin.service';

function makeSanitizer() {
  return { sanitize: (s: string) => s } as { sanitize: (s: string) => string };
}

let settings: { get: Mock; upsert: Mock };
let registry: HookRegistry;
let service: PluginService;

beforeEach(() => {
  settings = { get: vi.fn(), upsert: vi.fn() };
  registry = new HookRegistry();
  service = new PluginService(settings as never, registry, makeSanitizer() as never);
});

describe('PluginService', () => {
  it('list() reflects the persisted enabled set', async () => {
    settings.get.mockResolvedValue({ value: JSON.stringify(['reading-time']) });
    await service.loadEnabled();
    const list = await service.list();
    const byId = Object.fromEntries(list.map((p) => [p.id, p.enabled]));
    expect(byId['reading-time']).toBe(true);
    expect(byId['site-footer-note']).toBe(false);
  });

  it('defaults to all available plugins when the setting is missing', async () => {
    settings.get.mockResolvedValue(null);
    await service.loadEnabled();
    expect((await service.list()).every((p) => p.enabled)).toBe(true);
  });

  it('tolerates a malformed setting (enables all)', async () => {
    settings.get.mockResolvedValue({ value: 'not json' });
    await service.loadEnabled();
    expect((await service.list()).every((p) => p.enabled)).toBe(true);
  });

  it('setEnabled persists + updates the registry + returns the new list', async () => {
    settings.get.mockResolvedValue({ value: JSON.stringify([]) });
    settings.upsert.mockResolvedValue({});
    await service.loadEnabled();
    const list = await service.setEnabled('reading-time', true);
    expect(settings.upsert).toHaveBeenCalledWith(
      'enabledPlugins',
      JSON.stringify(['reading-time']),
    );
    expect(list.find((p) => p.id === 'reading-time')?.enabled).toBe(true);
  });

  it('setEnabled throws NotFound for an unknown plugin id', async () => {
    settings.get.mockResolvedValue(null);
    await service.loadEnabled();
    await expect(service.setEnabled('nope', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renderRegions returns sanitized region html for enabled plugins', async () => {
    settings.get.mockResolvedValue({ value: JSON.stringify(['site-footer-note']) });
    await service.loadEnabled();
    registry.addRegion('site.footer', () => '<p>x</p>', 10, 'site-footer-note');
    const regions = await service.renderRegions();
    expect(regions['site.footer']).toContain('<p>x</p>');
  });
});
