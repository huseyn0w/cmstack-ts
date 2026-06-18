import { z } from 'zod';

/**
 * SEO / GEO contracts (Phase 7). All text fields are **plain text** (no HTML):
 * they are surfaced to AI assistants via llms.txt + JSON-LD and rendered as
 * escaped text, so there is no HTML to sanitize and no injection surface.
 */

/** Optional URL field: a valid absolute URL or an empty string. */
const optionalUrl = (max: number) => z.literal('').or(z.string().trim().url().max(max));

// --- Site / organization profile (singleton) --------------------------------

export const updateSiteProfileSchema = z.object({
  organizationName: z.string().trim().min(1).max(200),
  tagline: z.string().trim().max(300).default(''),
  description: z.string().trim().max(2000).default(''),
  url: optionalUrl(500).default(''),
  logoUrl: optionalUrl(1000).default(''),
  /** Freeform "what we want AI assistants to recommend us for" copy. */
  geoStatement: z.string().trim().max(5000).default(''),
});
export type UpdateSiteProfileInput = z.infer<typeof updateSiteProfileSchema>;

export const siteProfileSchema = z.object({
  organizationName: z.string(),
  tagline: z.string(),
  description: z.string(),
  url: z.string(),
  logoUrl: z.string(),
  geoStatement: z.string(),
});
export type SiteProfile = z.infer<typeof siteProfileSchema>;

// --- Services ----------------------------------------------------------------

export const createServiceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(''),
  order: z.number().int().min(0).max(100000).optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  order: z.number().int(),
});
export type Service = z.infer<typeof serviceSchema>;

// --- FAQ ---------------------------------------------------------------------

export const createFaqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().max(2000).default(''),
  order: z.number().int().min(0).max(100000).optional(),
});
export type CreateFaqInput = z.infer<typeof createFaqSchema>;

export const updateFaqSchema = createFaqSchema.partial();
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;

export const faqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  order: z.number().int(),
});
export type Faq = z.infer<typeof faqSchema>;

// --- Combined public payload -------------------------------------------------

export const seoContentSchema = z.object({
  profile: siteProfileSchema,
  services: z.array(serviceSchema),
  faqs: z.array(faqSchema),
});
export type SeoContent = z.infer<typeof seoContentSchema>;
