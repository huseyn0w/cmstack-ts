import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaCommentRepository } from './comment.repository';

function make() {
  const comment = {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  };
  const $transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  const prisma = { comment, $transaction } as unknown as PrismaClient;
  return { repo: new PrismaCommentRepository(prisma), comment, $transaction };
}

describe('PrismaCommentRepository', () => {
  it('findApprovedById() scopes to an APPROVED comment on the post', async () => {
    const { repo, comment } = make();
    comment.findFirst.mockResolvedValue({ id: 'c1' });
    await repo.findApprovedById('c1', 'p1');
    expect(comment.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', postId: 'p1', status: 'APPROVED' },
      select: { id: true },
    });
  });

  it('listApprovedForPost() never selects the author email', async () => {
    const { repo, comment } = make();
    comment.findMany.mockResolvedValue([]);
    await repo.listApprovedForPost('p1');
    const args = comment.findMany.mock.calls[0]?.[0];
    expect(args).toEqual({
      where: { postId: 'p1', status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, parentId: true, authorName: true, content: true, createdAt: true },
    });
    expect(args.select).not.toHaveProperty('authorEmail');
  });

  it('listAndCount() filters by status only when provided and batches in a transaction', async () => {
    const { repo, comment, $transaction } = make();
    comment.findMany.mockResolvedValue([{ id: 'c1' }]);
    comment.count.mockResolvedValue(1);
    await repo.listAndCount({ status: 'PENDING', page: 1, perPage: 20 });
    expect(comment.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      include: { post: { select: { slug: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(comment.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('listAndCount() with no status uses an empty where', async () => {
    const { repo, comment } = make();
    comment.findMany.mockResolvedValue([]);
    comment.count.mockResolvedValue(0);
    await repo.listAndCount({ page: 2, perPage: 10 });
    expect(comment.count).toHaveBeenCalledWith({ where: {} });
    expect(comment.findMany.mock.calls[0]?.[0]).toMatchObject({ where: {}, skip: 10, take: 10 });
  });

  it('updateStatus() includes the post slug/title for the admin view', async () => {
    const { repo, comment } = make();
    comment.update.mockResolvedValue({});
    await repo.updateStatus('c1', 'SPAM');
    expect(comment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'SPAM' },
      include: { post: { select: { slug: true, title: true } } },
    });
  });
});
