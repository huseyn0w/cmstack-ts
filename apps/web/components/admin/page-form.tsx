'use client';

import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PageDetail } from '@cmstack-ts/config';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';

interface ActionOk<T> {
  ok: true;
  data: T;
}
interface ActionOkVoid {
  ok: true;
}
interface ActionFail {
  ok: false;
  error: string;
}

type CreateResult = ActionOk<{ id: string }> | ActionFail;
type UpdateResult = ActionOkVoid | ActionFail;

interface PageFormProps {
  page?: PageDetail;
  createAction?: (input: {
    title: string;
    slug?: string;
    content: string;
    status?: 'DRAFT' | 'PUBLISHED';
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    noindex?: boolean;
  }) => Promise<CreateResult>;
  updateAction?: (
    id: string,
    input: {
      title?: string;
      slug?: string;
      content?: string;
      status?: 'DRAFT' | 'PUBLISHED';
      metaTitle?: string;
      metaDescription?: string;
      canonicalUrl?: string;
      noindex?: boolean;
    },
  ) => Promise<UpdateResult>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function PageForm({ page, createAction, updateAction }: PageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!page?.slug);
  const [content, setContent] = useState(page?.content ?? '');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(page?.status ?? 'DRAFT');
  const [metaTitle, setMetaTitle] = useState(page?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(page?.metaDescription ?? '');
  const [canonicalUrl, setCanonicalUrl] = useState(page?.canonicalUrl ?? '');
  const [noindex, setNoindex] = useState(page?.noindex ?? false);

  const handleTitleChange = useCallback(
    (val: string) => {
      setTitle(val);
      if (!slugTouched) {
        setSlug(slugify(val));
      }
    },
    [slugTouched],
  );

  function submit(targetStatus: 'DRAFT' | 'PUBLISHED') {
    setStatus(targetStatus);
    const input = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      content,
      status: targetStatus,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      canonicalUrl: canonicalUrl.trim() || undefined,
      noindex,
    };

    startTransition(async () => {
      if (page && updateAction) {
        const result = await updateAction(page.id, input);
        if (result.ok) {
          toast.success('Page saved');
          router.push('/admin/pages');
        } else {
          toast.error(result.error);
        }
      } else if (createAction) {
        const result = await createAction(input);
        if (result.ok) {
          toast.success('Page created');
          router.push('/admin/pages');
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {page ? 'Edit page' : 'New page'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {page ? 'Update the page content and settings.' : 'Create a new page.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => submit('DRAFT')}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save as draft
          </Button>
          <Button size="sm" disabled={isPending} onClick={() => submit('PUBLISHED')}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Publish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
        {/* Main content */}
        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="page-title">Title</Label>
            <Input
              id="page-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Page title"
              autoFocus
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="page-slug">
              Slug <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="page-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="auto-generated-from-title"
              className="font-mono text-xs"
            />
            {!slugTouched && title && (
              <p className="text-xs text-muted-foreground">
                Auto-generated from title. Edit to override.
              </p>
            )}
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label>Content</Label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your page content here…"
            />
          </div>

          {/* SEO */}
          <fieldset className="space-y-4 rounded-md border border-border p-4">
            <legend className="px-1 text-sm font-medium text-foreground">SEO</legend>
            <div className="space-y-1.5">
              <Label htmlFor="page-meta-title">
                Meta title <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="page-meta-title"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Defaults to the page title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-meta-description">
                Meta description{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="page-meta-description"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="A short summary for search engines…"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-canonical">
                Canonical URL <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="page-canonical"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://example.com/canonical-path"
                className="font-mono text-xs"
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={noindex}
                onChange={(e) => setNoindex(e.target.checked)}
                className="rounded border-border accent-primary"
              />
              <span className="text-foreground">Hide from search engines (noindex)</span>
            </label>
          </fieldset>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="page-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'DRAFT' | 'PUBLISHED')}>
              <SelectTrigger id="page-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
