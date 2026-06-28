import { describe, expect, it, vi } from 'vitest';
import { ContentSchedulerService } from './content-scheduler.service';
import type { PagesService } from './pages.service';
import type { PostsService } from './posts.service';

describe('ContentSchedulerService', () => {
  it('runs publishDue on both posts and pages', async () => {
    const posts = { publishDue: vi.fn().mockResolvedValue(1) } as unknown as PostsService;
    const pages = { publishDue: vi.fn().mockResolvedValue(0) } as unknown as PagesService;
    await new ContentSchedulerService(posts, pages).runDuePublish();
    expect(posts.publishDue).toHaveBeenCalledOnce();
    expect(pages.publishDue).toHaveBeenCalledOnce();
  });

  it('swallows errors so the interval keeps running', async () => {
    const posts = {
      publishDue: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as PostsService;
    const pages = { publishDue: vi.fn() } as unknown as PagesService;
    await expect(
      new ContentSchedulerService(posts, pages).runDuePublish(),
    ).resolves.toBeUndefined();
  });
});
