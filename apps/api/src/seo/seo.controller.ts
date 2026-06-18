import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  type CreateFaqInput,
  type CreateServiceInput,
  type Faq,
  type Service,
  type SiteProfile,
  type UpdateFaqInput,
  type UpdateServiceInput,
  type UpdateSiteProfileInput,
  createFaqSchema,
  createServiceSchema,
  updateFaqSchema,
  updateServiceSchema,
  updateSiteProfileSchema,
} from '@typress/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SeoService } from './seo.service';

/**
 * Admin SEO / GEO API. Gated by the `Seo` subject (Administrators via manage-all,
 * and Editors who own SEO/content). All bodies are validated with shared schemas.
 */
@Controller('seo')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('profile')
  @CheckPolicies((a) => a.can('read', 'Seo'))
  getProfile(): Promise<SiteProfile> {
    return this.seo.getProfile();
  }

  @Put('profile')
  @CheckPolicies((a) => a.can('update', 'Seo'))
  updateProfile(
    @Body(new ZodValidationPipe(updateSiteProfileSchema)) body: UpdateSiteProfileInput,
  ): Promise<SiteProfile> {
    return this.seo.updateProfile(body);
  }

  @Get('services')
  @CheckPolicies((a) => a.can('read', 'Seo'))
  listServices(): Promise<Service[]> {
    return this.seo.listServices();
  }

  @Post('services')
  @CheckPolicies((a) => a.can('create', 'Seo'))
  createService(
    @Body(new ZodValidationPipe(createServiceSchema)) body: CreateServiceInput,
  ): Promise<Service> {
    return this.seo.createService(body);
  }

  @Patch('services/:id')
  @CheckPolicies((a) => a.can('update', 'Seo'))
  updateService(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceInput,
  ): Promise<Service> {
    return this.seo.updateService(id, body);
  }

  @Delete('services/:id')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('delete', 'Seo'))
  async removeService(@Param('id') id: string): Promise<void> {
    await this.seo.removeService(id);
  }

  @Get('faqs')
  @CheckPolicies((a) => a.can('read', 'Seo'))
  listFaqs(): Promise<Faq[]> {
    return this.seo.listFaqs();
  }

  @Post('faqs')
  @CheckPolicies((a) => a.can('create', 'Seo'))
  createFaq(@Body(new ZodValidationPipe(createFaqSchema)) body: CreateFaqInput): Promise<Faq> {
    return this.seo.createFaq(body);
  }

  @Patch('faqs/:id')
  @CheckPolicies((a) => a.can('update', 'Seo'))
  updateFaq(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFaqSchema)) body: UpdateFaqInput,
  ): Promise<Faq> {
    return this.seo.updateFaq(id, body);
  }

  @Delete('faqs/:id')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('delete', 'Seo'))
  async removeFaq(@Param('id') id: string): Promise<void> {
    await this.seo.removeFaq(id);
  }
}
