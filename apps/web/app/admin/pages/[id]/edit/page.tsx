import { PageForm } from '@/components/admin/page-form';
import { type TranslationField, TranslationsPanel } from '@/components/admin/translations-panel';
import { apiGet } from '@/lib/admin/api';
import { pageDetailSchema } from '@cmstack-ts/config';
import type { PageDetail } from '@cmstack-ts/config';
import { notFound } from 'next/navigation';
import {
  deletePageTranslationAction,
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

async function fetchPage(id: string): Promise<PageDetail | null> {
  try {
    return await apiGet(`/pages/${id}`, pageDetailSchema);
  } catch {
    return null;
  }
}

interface EditPagePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPagePage({ params }: EditPagePageProps) {
  const { id } = await params;
  const page = await fetchPage(id);

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
    </>
  );
}
