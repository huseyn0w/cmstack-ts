import type {
  PasswordResetTokenRepository,
  PasswordResetTokenRow,
  UserRepository,
} from '@cmstack-ts/db';
import { BadRequestException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailService } from '../mail/mail.service';
import { PasswordResetService } from './password-reset.service';
import type { PasswordService } from './password.service';

let users: { findIdByEmail: Mock; updatePasswordHash: Mock };
let tokens: Record<keyof PasswordResetTokenRepository, Mock>;
let passwords: { hash: Mock; verify: Mock };
let mail: { send: Mock };
let service: PasswordResetService;

function tokenRow(over: Partial<PasswordResetTokenRow> = {}): PasswordResetTokenRow {
  return {
    id: 't1',
    userId: 'u1',
    tokenHash: 'h',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    ...over,
  } as PasswordResetTokenRow;
}

beforeEach(() => {
  process.env.WEB_ORIGIN = 'https://site.test';
  users = { findIdByEmail: vi.fn(), updatePasswordHash: vi.fn() };
  tokens = {
    create: vi.fn(),
    findByHash: vi.fn(),
    markUsed: vi.fn(),
    deleteAllForUser: vi.fn(),
  };
  passwords = { hash: vi.fn().mockResolvedValue('new-hash'), verify: vi.fn() };
  mail = { send: vi.fn().mockResolvedValue(undefined) };
  service = new PasswordResetService(
    users as unknown as UserRepository,
    tokens as unknown as PasswordResetTokenRepository,
    passwords as unknown as PasswordService,
    mail as unknown as MailService,
  );
});

describe('PasswordResetService.request', () => {
  it('for a known email: clears old tokens, stores a hashed token, and emails a link', async () => {
    users.findIdByEmail.mockResolvedValue({ id: 'u1' });
    await service.request({ email: 'a@test.local' });
    expect(tokens.deleteAllForUser).toHaveBeenCalledWith('u1');
    const created = tokens.create.mock.calls[0]?.[0];
    expect(created.userId).toBe('u1');
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha-256 hex, not the raw token
    expect(created.expiresAt).toBeInstanceOf(Date);
    const sent = mail.send.mock.calls[0]?.[0];
    expect(sent.to).toBe('a@test.local');
    expect(sent.text).toContain('https://site.test/reset-password?token=');
    // The emailed raw token is NOT the stored hash.
    const urlToken = sent.text.match(/token=([a-f0-9]+)/)?.[1];
    expect(urlToken).not.toBe(created.tokenHash);
  });

  it('for an unknown email: no token, no email, but resolves (no enumeration)', async () => {
    users.findIdByEmail.mockResolvedValue(null);
    await expect(service.request({ email: 'ghost@test.local' })).resolves.toBeUndefined();
    expect(tokens.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('PasswordResetService.confirm', () => {
  it('rehashes the password, marks the token used, on a valid token', async () => {
    tokens.findByHash.mockResolvedValue(tokenRow());
    await service.confirm({ token: 'raw', password: 'new-password-123' });
    expect(passwords.hash).toHaveBeenCalledWith('new-password-123');
    expect(users.updatePasswordHash).toHaveBeenCalledWith('u1', 'new-hash');
    expect(tokens.markUsed).toHaveBeenCalledWith('t1');
  });

  it('rejects an unknown token', async () => {
    tokens.findByHash.mockResolvedValue(null);
    await expect(
      service.confirm({ token: 'x', password: 'new-password-123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    tokens.findByHash.mockResolvedValue(tokenRow({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(
      service.confirm({ token: 'x', password: 'new-password-123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('rejects an already-used token (no replay)', async () => {
    tokens.findByHash.mockResolvedValue(tokenRow({ usedAt: new Date() }));
    await expect(
      service.confirm({ token: 'x', password: 'new-password-123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });
});
