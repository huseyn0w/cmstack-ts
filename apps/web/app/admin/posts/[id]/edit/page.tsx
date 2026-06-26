import { PostForm } from '@/components/admin/post-form';
import { RevisionsPanel } from '@/components/admin/revisions-panel';
import { type TranslationField, TranslationsPanel } from '@/components/admin/translations-panel';
import { apiGet } from '@/lib/admin/api';
import type { RevisionField, RevisionView } from '@/lib/admin/revision-compare';
import type { CategoryView, TagView } from '@/types/content';
import { postDetailSchema } from '@cmstack-ts/config';
import type { PostDetail } from '@cmstack-ts/config';
import { notFound } from 'next/navigation';
import {
  deletePostTranslationAction,
  restorePostRevisionAction,
  updatePostAction,
  upsertPostTranslationAction,
} from '../../actions';

export const dynamic = 'force-dynamic';

const POST_FIELDS: TranslationField[] = [
  { key: 'title', label: 'Title', type: 'input' },
  { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
  { key: 'content', label: 'Content', type: 'richtext' },
  { key: 'metaTitle', label: 'Meta title', type: 'input' },
  { key: 'metaDescription', label: 'Meta description', type: 'textarea' },
];

const POST_REVISION_FIELDS: RevisionField[] = [
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'excerpt', label: 'Excerpt' },
  { key: 'content', label: 'Content' },
  { key: 'status', label: 'Status' },
];

async function fetchRevisions(id: string): Promise<RevisionView[]> {
  try {
    return await apiGet<RevisionView[]>(`/posts/${id}/revisions`);
  } catch {
    return [];
  }
}

async function fetchPost(id: string): Promise<PostDetail | null> {
  try {
    return await apiGet(`/posts/${id}`, postDetailSchema);
  } catch {
    return null;
  }
}

async function fetchCategories(): Promise<CategoryView[]> {
  try {
    return await apiGet<CategoryView[]>('/categories');
  } catch {
    return [];
  }
}

async function fetchTags(): Promise<TagView[]> {
  try {
    return await apiGet<TagView[]>('/tags');
  } catch {
    return [];
  }
}

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const [post, categories, tags, revisions] = await Promise.all([
    fetchPost(id),
    fetchCategories(),
    fetchTags(),
    fetchRevisions(id),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <>
      <PostForm post={post} categories={categories} tags={tags} updateAction={updatePostAction} />
      <TranslationsPanel
        entityId={post.id}
        base={{
          title: post.title,
          excerpt: post.excerpt ?? '',
          content: post.content ?? '',
          metaTitle: post.metaTitle ?? '',
          metaDescription: post.metaDescription ?? '',
        }}
        translations={post.translations}
        fields={POST_FIELDS}
        upsertAction={upsertPostTranslationAction}
        deleteAction={deletePostTranslationAction}
      />
      <RevisionsPanel
        id={post.id}
        current={{
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? '',
          content: post.content,
          status: post.status,
        }}
        revisions={revisions}
        fields={POST_REVISION_FIELDS}
        restoreAction={restorePostRevisionAction}
      />
    </>
  );
}
