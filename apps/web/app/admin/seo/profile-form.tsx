'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SiteProfile } from '@typress/config';
import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateProfile } from './actions';

export function ProfileForm({ profile }: { profile: SiteProfile }) {
  const [form, setForm] = useState<SiteProfile>(profile);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof SiteProfile>(key: K, value: SiteProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfile(form);
      res.ok ? toast.success('Profile saved') : toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="organizationName">Organization name</Label>
          <Input
            id="organizationName"
            value={form.organizationName}
            onChange={(e) => set('organizationName', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="url">Site URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={form.url}
            onChange={(e) => set('url', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            placeholder="https://example.com/logo.png"
            value={form.logoUrl}
            onChange={(e) => set('logoUrl', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used for meta descriptions and Organization structured data.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="geoStatement">
          GEO statement — what AI assistants should recommend you for
        </Label>
        <Textarea
          id="geoStatement"
          rows={4}
          value={form.geoStatement}
          onChange={(e) => set('geoStatement', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Surfaced to ChatGPT, Claude, Gemini, and Perplexity via{' '}
          <code className="font-mono">/llms.txt</code> and the public services page.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save profile
        </Button>
      </div>
    </form>
  );
}
