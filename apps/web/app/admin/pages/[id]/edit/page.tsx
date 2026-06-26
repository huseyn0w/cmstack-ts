import { PageForm } from '@/components/admin/page-form';
import { RevisionsPanel } from '@/components/admin/revisions-panel';
import { type TranslationField, TranslationsPanel } from '@/components/admin/translations-panel';
import { apiGet } from '@/lib/admin/api';
import type { RevisionField, RevisionView } from '@/lib/admin/revision-compare';
import { pageDetailSchema } from '@cmstack-ts/config';
import type { PageDetail } from '@cmstack-ts/config';
import { notFound } from 'next/navigation';
import {
  deletePageTranslationAction,
  restorePageRevisionAction,
  updatePageAction,
  upsertPageTranslationAction,
} from '../../actions';

export const dynamic = 'force-dynamic';

const PAGE_FIELDS: TranslationField[] = [
  { key: 'title', label: 'Title', type: 'input' },
  { key: 'content', label: 'Content', type: 'richtext' },
  { key: 'metaTitle', label: 'Meta title', type: 'input' },
  { key: 'metaDescription', label: 'Meta description', type: 'textarea' },
];

const PAGE_REVISION_FIELDS: RevisionField[] = [
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'content', label: 'Content' },
  { key: 'status', label: 'Status' },
];

async function fetchPage(id: string): Promise<PageDetail | null> {
  try {
    return await apiGet(`/pages/${id}`, pageDetailSchema);
  } catch {
    return null;
  }
}

async function fetchPageRevisions(id: string): Promise<RevisionView[]> {
  try {
    return await apiGet<RevisionView[]>(`/pages/${id}/revisions`);
  } catch {
    return [];
  }
}

interface EditPagePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPagePage({ params }: EditPagePageProps) {
  const { id } = await params;
  const [page, revisions] = await Promise.all([fetchPage(id), fetchPageRevisions(id)]);

  if (!page) {
    notFound();
  }

  return (
    <>
      <PageForm page={page} updateAction={updatePageAction} />
      <TranslationsPanel
        entityId={page.id}
        base={{
          title: page.title,
          content: page.content ?? '',
          metaTitle: page.metaTitle ?? '',
          metaDescription: page.metaDescription ?? '',
        }}
        translations={page.translations}
        fields={PAGE_FIELDS}
        upsertAction={upsertPageTranslationAction}
        deleteAction={deletePageTranslationAction}
      />
      <RevisionsPanel
        id={page.id}
        current={{
          title: page.title,
          slug: page.slug,
          content: page.content,
          status: page.status,
        }}
        revisions={revisions}
        fields={PAGE_REVISION_FIELDS}
        restoreAction={restorePageRevisionAction}
      />
    </>
  );
}
