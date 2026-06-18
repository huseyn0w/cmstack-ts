import { getSeoContent } from '@/lib/seo/fetch';
import { JsonLd } from '@/lib/seo/json-ld';
import { faqPageJsonLd, servicesJsonLd } from '@/lib/seo/jsonld';
import { getActiveTheme } from '@/themes/active-theme';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Services',
  description: 'What we offer and answers to common questions.',
  alternates: { canonical: '/services' },
};

export default async function ServicesPage() {
  const [{ Layout }, { profile, services, faqs }] = await Promise.all([
    getActiveTheme(),
    getSeoContent(),
  ]);

  return (
    <>
      {services.length > 0 && <JsonLd data={servicesJsonLd(services, profile)} />}
      {faqs.length > 0 && <JsonLd data={faqPageJsonLd(faqs)} />}
      <Layout>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 1rem' }}>Services</h1>
          {profile.geoStatement && (
            <p
              style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1.6, margin: '0 0 2.5rem' }}
            >
              {profile.geoStatement}
            </p>
          )}

          {services.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No services listed yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 3rem' }}>
              {services.map((service) => (
                <li
                  key={service.id}
                  style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--line)' }}
                >
                  <h2 style={{ fontSize: 20, margin: '0 0 0.4rem' }}>{service.name}</h2>
                  {service.description && (
                    <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
                      {service.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {faqs.length > 0 && (
            <section>
              <h2 style={{ fontSize: 24, margin: '0 0 1.5rem' }}>Frequently asked questions</h2>
              <dl style={{ margin: 0 }}>
                {faqs.map((faq) => (
                  <div key={faq.id} style={{ marginBottom: '1.5rem' }}>
                    <dt style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{faq.question}</dt>
                    <dd style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </Layout>
    </>
  );
}
