import type {
  CreateFaqInput,
  CreateServiceInput,
  Faq,
  SeoContent,
  Service,
  SiteProfile,
  UpdateFaqInput,
  UpdateServiceInput,
  UpdateSiteProfileInput,
} from '@cmstack-ts/config';
import {
  FAQ_REPOSITORY,
  type FaqRepository,
  SERVICE_REPOSITORY,
  SITE_PROFILE_REPOSITORY,
  type ServiceRepository,
  type SiteProfile as DbSiteProfile,
  type SiteProfileRepository,
} from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

const DEFAULT_PROFILE: SiteProfile = {
  organizationName: 'Cmstack-TS',
  tagline: '',
  description: '',
  url: '',
  logoUrl: '',
  geoStatement: '',
};

@Injectable()
export class SeoService {
  constructor(
    @Inject(SITE_PROFILE_REPOSITORY) private readonly profiles: SiteProfileRepository,
    @Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository,
    @Inject(FAQ_REPOSITORY) private readonly faqs: FaqRepository,
  ) {}

  // --- Profile (singleton) ---------------------------------------------------

  async getProfile(): Promise<SiteProfile> {
    const row = await this.profiles.get();
    return row ? this.toProfile(row) : DEFAULT_PROFILE;
  }

  async updateProfile(input: UpdateSiteProfileInput): Promise<SiteProfile> {
    const row = await this.profiles.upsert(input);
    return this.toProfile(row);
  }

  // --- Services --------------------------------------------------------------

  async listServices(): Promise<Service[]> {
    const rows = await this.services.list();
    return rows.map((r) => this.toService(r));
  }

  async createService(input: CreateServiceInput): Promise<Service> {
    const row = await this.services.create({
      name: input.name,
      description: input.description,
      order: input.order ?? 0,
    });
    return this.toService(row);
  }

  async updateService(id: string, input: UpdateServiceInput): Promise<Service> {
    await this.ensureService(id);
    const row = await this.services.update(id, {
      name: input.name,
      description: input.description,
      order: input.order,
    });
    return this.toService(row);
  }

  async removeService(id: string): Promise<void> {
    await this.ensureService(id);
    await this.services.hardDelete(id);
  }

  // --- FAQ -------------------------------------------------------------------

  async listFaqs(): Promise<Faq[]> {
    const rows = await this.faqs.list();
    return rows.map((r) => this.toFaq(r));
  }

  async createFaq(input: CreateFaqInput): Promise<Faq> {
    const row = await this.faqs.create({
      question: input.question,
      answer: input.answer,
      order: input.order ?? 0,
    });
    return this.toFaq(row);
  }

  async updateFaq(id: string, input: UpdateFaqInput): Promise<Faq> {
    await this.ensureFaq(id);
    const row = await this.faqs.update(id, {
      question: input.question,
      answer: input.answer,
      order: input.order,
    });
    return this.toFaq(row);
  }

  async removeFaq(id: string): Promise<void> {
    await this.ensureFaq(id);
    await this.faqs.hardDelete(id);
  }

  // --- Combined public payload ----------------------------------------------

  async getPublicContent(): Promise<SeoContent> {
    const [profile, services, faqs] = await Promise.all([
      this.getProfile(),
      this.listServices(),
      this.listFaqs(),
    ]);
    return { profile, services, faqs };
  }

  private async ensureService(id: string): Promise<void> {
    if (!(await this.services.exists(id))) throw new NotFoundException('Service not found.');
  }

  private async ensureFaq(id: string): Promise<void> {
    if (!(await this.faqs.exists(id))) throw new NotFoundException('FAQ item not found.');
  }

  private toProfile(row: DbSiteProfile): SiteProfile {
    return {
      organizationName: row.organizationName,
      tagline: row.tagline,
      description: row.description,
      url: row.url,
      logoUrl: row.logoUrl,
      geoStatement: row.geoStatement,
    };
  }

  private toService(row: {
    id: string;
    name: string;
    description: string;
    order: number;
  }): Service {
    return { id: row.id, name: row.name, description: row.description, order: row.order };
  }

  private toFaq(row: { id: string; question: string; answer: string; order: number }): Faq {
    return { id: row.id, question: row.question, answer: row.answer, order: row.order };
  }
}
