import { apiGet } from '@/lib/admin/api';
import { canManageSeo, requireAdminSession } from '@/lib/admin/guard';
import { faqSchema, serviceSchema, siteProfileSchema } from '@typress/config';
import type { Faq, Service, SiteProfile } from '@typress/config';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  createFaq,
  createService,
  deleteFaq,
  deleteService,
  updateFaq,
  updateService,
} from './actions';
import { EntryCrud } from './entry-crud';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

const DEFAULT_PROFILE: SiteProfile = {
  organizationName: 'Typress',
  tagline: '',
  description: '',
  url: '',
  logoUrl: '',
  geoStatement: '',
};

async function fetchProfile(): Promise<SiteProfile> {
  try {
    return await apiGet('/seo/profile', siteProfileSchema);
  } catch {
    return DEFAULT_PROFILE;
  }
}

async function fetchServices(): Promise<Service[]> {
  try {
    return await apiGet('/seo/services', z.array(serviceSchema));
  } catch {
    return [];
  }
}

async function fetchFaqs(): Promise<Faq[]> {
  try {
    return await apiGet('/seo/faqs', z.array(faqSchema));
  } catch {
    return [];
  }
}

export default async function SeoPage() {
  const session = await requireAdminSession();
  if (!canManageSeo(session)) {
    redirect('/admin');
  }

  const [profile, services, faqs] = await Promise.all([
    fetchProfile(),
    fetchServices(),
    fetchFaqs(),
  ]);

  return (
    <div className="px-6 py-10 max-w-3xl mx-auto space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">SEO &amp; GEO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control how search engines and AI assistants discover and describe your site.
          </p>
        </div>
        <Link
          href="/llms.txt"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View llms.txt
        </Link>
      </div>

      <ProfileForm profile={profile} />

      <div className="border-t border-border" />

      <EntryCrud
        title="Services"
        description="Listed on /services and exposed as Service structured data + llms.txt."
        primaryLabel="Name"
        secondaryLabel="Description"
        items={services.map((s) => ({ id: s.id, primary: s.name, secondary: s.description }))}
        onCreate={createService}
        onUpdate={updateService}
        onDelete={deleteService}
      />

      <div className="border-t border-border" />

      <EntryCrud
        title="FAQs"
        description="Exposed as FAQPage structured data + llms.txt so assistants can answer for you."
        primaryLabel="Question"
        secondaryLabel="Answer"
        items={faqs.map((f) => ({ id: f.id, primary: f.question, secondary: f.answer }))}
        onCreate={createFaq}
        onUpdate={updateFaq}
        onDelete={deleteFaq}
      />
    </div>
  );
}
