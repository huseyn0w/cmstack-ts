import type {
  FaqItem,
  FaqRepository,
  Service,
  ServiceRepository,
  SiteProfile,
  SiteProfileRepository,
} from '@cmstack-ts/db';
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheService } from '../cache/cache.service';
import type { HookRegistry } from '../plugins/hook-registry';
import { SeoService } from './seo.service';

const fullProfile: SiteProfile = {
  id: 'default',
  organizationName: 'Acme',
  tagline: 'tag',
  description: 'desc',
  url: 'https://acme.test',
  logoUrl: '',
  geoStatement: 'geo',
  contactEmail: '',
  ga4MeasurementId: '',
  gtmContainerId: '',
  googleSiteVerification: '',
  bingSiteVerification: '',
  yandexVerification: '',
  facebookDomainVerification: '',
  pinterestVerification: '',
  customVerificationTags: [],
  updatedAt: new Date(),
};

let profiles: Record<keyof SiteProfileRepository, Mock>;
let services: Record<keyof ServiceRepository, Mock>;
let faqs: Record<keyof FaqRepository, Mock>;
let cache: { getOrSet: Mock; invalidate: Mock };
let hooks: { emit: Mock };
let service: SeoService;

beforeEach(() => {
  profiles = { get: vi.fn(), upsert: vi.fn() };
  services = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  faqs = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  cache = {
    getOrSet: vi.fn((_key: string, factory: () => Promise<unknown>) => factory()),
    invalidate: vi.fn(),
  };
  hooks = { emit: vi.fn().mockResolvedValue(undefined) };
  service = new SeoService(
    profiles as unknown as SiteProfileRepository,
    services as unknown as ServiceRepository,
    faqs as unknown as FaqRepository,
    cache as unknown as CacheService,
    hooks as unknown as HookRegistry,
  );
});

describe('SeoService profile', () => {
  it('returns the default profile when none is stored', async () => {
    profiles.get.mockResolvedValue(null);
    const result = await service.getProfile();
    expect(result.organizationName).toBe('Cmstack-TS');
    expect(result).not.toHaveProperty('id');
  });

  it('maps a stored row to the public profile shape (drops id/updatedAt)', async () => {
    profiles.get.mockResolvedValue(fullProfile);
    const result = await service.getProfile();
    expect(result).toEqual({
      organizationName: 'Acme',
      tagline: 'tag',
      description: 'desc',
      url: 'https://acme.test',
      logoUrl: '',
      geoStatement: 'geo',
      contactEmail: '',
      ga4MeasurementId: '',
      gtmContainerId: '',
      googleSiteVerification: '',
      bingSiteVerification: '',
      yandexVerification: '',
      facebookDomainVerification: '',
      pinterestVerification: '',
      customVerificationTags: [],
    });
  });

  it('updateProfile upserts the input and returns the mapped profile', async () => {
    const input = {
      organizationName: 'New',
      tagline: '',
      description: '',
      url: '',
      logoUrl: '',
      geoStatement: '',
      contactEmail: '',
      ga4MeasurementId: '',
      gtmContainerId: '',
      googleSiteVerification: '',
      bingSiteVerification: '',
      yandexVerification: '',
      facebookDomainVerification: '',
      pinterestVerification: '',
      customVerificationTags: [],
    };
    profiles.upsert.mockResolvedValue({ id: 'default', ...input, updatedAt: new Date() });
    const result = await service.updateProfile(input);
    expect(profiles.upsert).toHaveBeenCalledWith(input);
    expect(result.organizationName).toBe('New');
  });

  it('persists and returns analytics + verification fields', async () => {
    const input = {
      organizationName: 'Acme',
      tagline: '',
      description: '',
      url: '',
      logoUrl: '',
      geoStatement: '',
      contactEmail: '',
      ga4MeasurementId: 'G-ABC123',
      gtmContainerId: 'GTM-XYZ99',
      googleSiteVerification: 'g-tok',
      bingSiteVerification: '',
      yandexVerification: '',
      facebookDomainVerification: '',
      pinterestVerification: '',
      customVerificationTags: [{ name: 'p:domain_verify', content: 'pin' }],
    };
    profiles.upsert.mockResolvedValue({ id: 'default', ...input, updatedAt: new Date() });
    const result = await service.updateProfile(input);
    expect(profiles.upsert).toHaveBeenCalledWith(input);
    expect(result.ga4MeasurementId).toBe('G-ABC123');
    expect(result.gtmContainerId).toBe('GTM-XYZ99');
    expect(result.customVerificationTags).toEqual([{ name: 'p:domain_verify', content: 'pin' }]);
  });
});

describe('SeoService services', () => {
  it('createService defaults a missing order to 0', async () => {
    services.create.mockResolvedValue({
      id: 's1',
      name: 'n',
      description: 'd',
      order: 0,
    } as Service);
    await service.createService({ name: 'n', description: 'd' });
    expect(services.create).toHaveBeenCalledWith({ name: 'n', description: 'd', order: 0 });
  });

  it('updateService throws NotFound when the service is absent', async () => {
    services.exists.mockResolvedValue(false);
    await expect(service.updateService('missing', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(services.update).not.toHaveBeenCalled();
  });

  it('removeService checks existence then hard-deletes', async () => {
    services.exists.mockResolvedValue(true);
    await service.removeService('s1');
    expect(services.hardDelete).toHaveBeenCalledWith('s1');
  });

  it('listServices maps rows to the public service shape', async () => {
    services.list.mockResolvedValue([
      {
        id: 's1',
        name: 'n',
        description: 'd',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as Service[]);
    expect(await service.listServices()).toEqual([
      { id: 's1', name: 'n', description: 'd', order: 2 },
    ]);
  });
});

describe('SeoService faqs', () => {
  it('createFaq defaults a missing order to 0', async () => {
    faqs.create.mockResolvedValue({ id: 'f1', question: 'q', answer: 'a', order: 0 } as FaqItem);
    await service.createFaq({ question: 'q', answer: 'a' });
    expect(faqs.create).toHaveBeenCalledWith({ question: 'q', answer: 'a', order: 0 });
  });

  it('removeFaq throws NotFound when absent', async () => {
    faqs.exists.mockResolvedValue(false);
    await expect(service.removeFaq('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(faqs.hardDelete).not.toHaveBeenCalled();
  });
});

describe('SeoService public content', () => {
  it('combines profile, services and faqs', async () => {
    profiles.get.mockResolvedValue(null);
    services.list.mockResolvedValue([]);
    faqs.list.mockResolvedValue([]);
    const result = await service.getPublicContent();
    expect(result).toEqual({
      profile: expect.objectContaining({ organizationName: 'Cmstack-TS' }),
      services: [],
      faqs: [],
    });
  });

  it('reads public content through the cache', async () => {
    profiles.get.mockResolvedValue(null);
    services.list.mockResolvedValue([]);
    faqs.list.mockResolvedValue([]);
    await service.getPublicContent();
    expect(cache.getOrSet).toHaveBeenCalled();
  });
});

describe('SeoService invalidation', () => {
  it('emits seo.changed after a profile update', async () => {
    const input = {
      organizationName: 'New',
      tagline: '',
      description: '',
      url: '',
      logoUrl: '',
      geoStatement: '',
      contactEmail: '',
      ga4MeasurementId: '',
      gtmContainerId: '',
      googleSiteVerification: '',
      bingSiteVerification: '',
      yandexVerification: '',
      facebookDomainVerification: '',
      pinterestVerification: '',
      customVerificationTags: [],
    };
    profiles.upsert.mockResolvedValue({ id: 'default', ...input, updatedAt: new Date() });
    await service.updateProfile(input);
    expect(hooks.emit).toHaveBeenCalledWith('seo.changed', {});
  });

  it('emits seo.changed after creating a service', async () => {
    services.create.mockResolvedValue({ id: 's1', name: 'n', description: 'd', order: 0 } as Service);
    await service.createService({ name: 'n', description: 'd' });
    expect(hooks.emit).toHaveBeenCalledWith('seo.changed', {});
  });

  it('emits seo.changed after removing a faq', async () => {
    faqs.exists.mockResolvedValue(true);
    await service.removeFaq('f1');
    expect(hooks.emit).toHaveBeenCalledWith('seo.changed', {});
  });
});
