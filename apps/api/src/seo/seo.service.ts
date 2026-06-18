import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
} from '@typress/config';
import type { PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';

const PROFILE_ID = 'default';

const DEFAULT_PROFILE: SiteProfile = {
  organizationName: 'Typress',
  tagline: '',
  description: '',
  url: '',
  logoUrl: '',
  geoStatement: '',
};

@Injectable()
export class SeoService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  // --- Profile (singleton) ---------------------------------------------------

  async getProfile(): Promise<SiteProfile> {
    const row = await this.prisma.siteProfile.findUnique({ where: { id: PROFILE_ID } });
    return row ? this.toProfile(row) : DEFAULT_PROFILE;
  }

  async updateProfile(input: UpdateSiteProfileInput): Promise<SiteProfile> {
    const row = await this.prisma.siteProfile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, ...input },
      update: input,
    });
    return this.toProfile(row);
  }

  // --- Services --------------------------------------------------------------

  async listServices(): Promise<Service[]> {
    const rows = await this.prisma.service.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toService(r));
  }

  async createService(input: CreateServiceInput): Promise<Service> {
    const row = await this.prisma.service.create({
      data: { name: input.name, description: input.description, order: input.order ?? 0 },
    });
    return this.toService(row);
  }

  async updateService(id: string, input: UpdateServiceInput): Promise<Service> {
    await this.ensureService(id);
    const row = await this.prisma.service.update({
      where: { id },
      data: { name: input.name, description: input.description, order: input.order },
    });
    return this.toService(row);
  }

  async removeService(id: string): Promise<void> {
    await this.ensureService(id);
    await this.prisma.service.delete({ where: { id } });
  }

  // --- FAQ -------------------------------------------------------------------

  async listFaqs(): Promise<Faq[]> {
    const rows = await this.prisma.faqItem.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toFaq(r));
  }

  async createFaq(input: CreateFaqInput): Promise<Faq> {
    const row = await this.prisma.faqItem.create({
      data: { question: input.question, answer: input.answer, order: input.order ?? 0 },
    });
    return this.toFaq(row);
  }

  async updateFaq(id: string, input: UpdateFaqInput): Promise<Faq> {
    await this.ensureFaq(id);
    const row = await this.prisma.faqItem.update({
      where: { id },
      data: { question: input.question, answer: input.answer, order: input.order },
    });
    return this.toFaq(row);
  }

  async removeFaq(id: string): Promise<void> {
    await this.ensureFaq(id);
    await this.prisma.faqItem.delete({ where: { id } });
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
    const row = await this.prisma.service.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('Service not found.');
  }

  private async ensureFaq(id: string): Promise<void> {
    const row = await this.prisma.faqItem.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('FAQ item not found.');
  }

  private toProfile(row: SiteProfile): SiteProfile {
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
