import { Controller, Get } from '@nestjs/common';
import type { SeoContent } from '@typress/config';
import { SeoService } from './seo.service';

/**
 * Public, unauthenticated SEO/GEO payload for the server-rendered site: feeds
 * sitemap/robots/llms.txt, JSON-LD, and the /services page. Read-only.
 */
@Controller('public/seo')
export class PublicSeoController {
  constructor(private readonly seo: SeoService) {}

  @Get()
  getContent(): Promise<SeoContent> {
    return this.seo.getPublicContent();
  }
}
