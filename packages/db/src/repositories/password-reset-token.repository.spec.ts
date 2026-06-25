import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaPasswordResetTokenRepository } from './password-reset-token.repository';

function make() {
  const passwordResetToken = {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  };
  const prisma = { passwordResetToken } as unknown as PrismaClient;
  return { repo: new PrismaPasswordResetTokenRepository(prisma), passwordResetToken };
}

describe('PrismaPasswordResetTokenRepository', () => {
  it('create stores the row', async () => {
    const { repo, passwordResetToken } = make();
    passwordResetToken.create.mockResolvedValue({});
    const expiresAt = new Date('2026-01-01T00:00:00Z');
    await repo.create({ userId: 'u1', tokenHash: 'h', expiresAt });
    expect(passwordResetToken.create).toHaveBeenCalledWith({
      data: { userId: 'u1', tokenHash: 'h', expiresAt },
    });
  });

  it('findByHash looks up by the unique tokenHash', async () => {
    const { repo, passwordResetToken } = make();
    passwordResetToken.findUnique.mockResolvedValue(null);
    await repo.findByHash('h');
    expect(passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: 'h' } });
  });

  it('markUsed stamps usedAt on the token', async () => {
    const { repo, passwordResetToken } = make();
    passwordResetToken.update.mockResolvedValue({});
    await repo.markUsed('t1');
    const arg = passwordResetToken.update.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ id: 't1' });
    expect(arg.data.usedAt).toBeInstanceOf(Date);
  });

  it('deleteAllForUser removes every token for the user', async () => {
    const { repo, passwordResetToken } = make();
    passwordResetToken.deleteMany.mockResolvedValue({ count: 2 });
    await repo.deleteAllForUser('u1');
    expect(passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});
