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
import { cn } from '@/lib/utils';
import type { CategoryView, TagView } from '@/types/content';
import type { PostDetail } from '@cmstack-ts/config';
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

interface PostFormProps {
  categories: CategoryView[];
  tags: TagView[];
  post?: PostDetail;
  createAction?: (input: {
    title: string;
    slug?: string;
    excerpt?: string;
    content: string;
    status?: 'DRAFT' | 'PUBLISHED';
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    noindex?: boolean;
    categoryIds?: string[];
    tagIds?: string[];
  }) => Promise<CreateResult>;
  updateAction?: (
    id: string,
    input: {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      status?: 'DRAFT' | 'PUBLISHED';
      metaTitle?: string;
      metaDescription?: string;
      canonicalUrl?: string;
      noindex?: boolean;
      categoryIds?: string[];
      tagIds?: string[];
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

export function PostForm({ categories, tags, post, createAction, updateAction }: PostFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!post?.slug);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(post?.status ?? 'DRAFT');
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? '');
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonicalUrl ?? '');
  const [noindex, setNoindex] = useState(post?.noindex ?? false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    post?.categories.map((c) => c.id) ?? [],
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(post?.tags.map((t) => t.id) ?? []);

  const handleTitleChange = useCallback(
    (val: string) => {
      setTitle(val);
      if (!slugTouched) {
        setSlug(slugify(val));
      }
    },
    [slugTouched],
  );

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function submit(targetStatus: 'DRAFT' | 'PUBLISHED') {
    setStatus(targetStatus);
    const input = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      content,
      status: targetStatus,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      canonicalUrl: canonicalUrl.trim() || undefined,
      noindex,
      categoryIds: selectedCategoryIds,
      tagIds: selectedTagIds,
    };

    startTransition(async () => {
      if (post && updateAction) {
        const result = await updateAction(post.id, input);
        if (result.ok) {
          toast.success('Post saved');
          router.push('/admin/posts');
        } else {
          toast.error(result.error);
        }
      } else if (createAction) {
        const result = await createAction(input);
        if (result.ok) {
          toast.success('Post created');
          router.push('/admin/posts');
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
            {post ? 'Edit post' : 'New post'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {post ? 'Update the post content and settings.' : 'Create a new post.'}
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
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Post title"
              autoFocus
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="post-slug">
              Slug <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="post-slug"
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

          {/* Excerpt */}
          <div className="space-y-1.5">
            <Label htmlFor="post-excerpt">
              Excerpt <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="post-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A short summary shown in post listings…"
              rows={3}
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label>Content</Label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your post content here…"
            />
          </div>

          {/* SEO */}
          <fieldset className="space-y-4 rounded-md border border-border p-4">
            <legend className="px-1 text-sm font-medium text-foreground">SEO</legend>
            <div className="space-y-1.5">
              <Label htmlFor="post-meta-title">
                Meta title <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="post-meta-title"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Defaults to the post title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-meta-description">
                Meta description{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="post-meta-description"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Defaults to the excerpt"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-canonical">
                Canonical URL <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="post-canonical"
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
              <span className="text-foreground">
                Hide from search engines (noindex; excludes from sitemap)
              </span>
            </label>
          </fieldset>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="post-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'DRAFT' | 'PUBLISHED')}>
              <SelectTrigger id="post-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label>Categories</Label>
              <div className="rounded-md border border-border bg-card max-h-40 overflow-y-auto">
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer',
                      'hover:bg-muted/50 transition-colors duration-100',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="rounded border-border accent-primary"
                    />
                    <span className="text-foreground">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="rounded-md border border-border bg-card max-h-40 overflow-y-auto">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer',
                      'hover:bg-muted/50 transition-colors duration-100',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="rounded border-border accent-primary"
                    />
                    <span className="text-foreground">{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
