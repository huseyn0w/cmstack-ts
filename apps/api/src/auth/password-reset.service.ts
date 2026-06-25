import { createHash, randomBytes } from 'node:crypto';
import type { PasswordResetConfirmInput, PasswordResetRequestInput } from '@cmstack-ts/config';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepository,
  USER_REPOSITORY,
  type UserRepository,
} from '@cmstack-ts/db';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/password-reset-email';
import { PasswordService } from './password.service';

/** SHA-256 hex digest — only the hash of a reset token is ever persisted. */
function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Password reset: issue a single-use, expiring, hashed token by email, then
 * accept it to set a new password. Designed to leak nothing about which emails
 * are registered (the request path always succeeds) and to never store or log
 * the raw token (only its SHA-256 hash is persisted; the raw token lives only in
 * the emailed link).
 */
@Injectable()
export class PasswordResetService {
  private readonly ttlMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 60);
  private readonly webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
  ) {}

  /**
   * Email a reset link if the address belongs to a user. Always resolves the
   * same way regardless of whether the email exists (no account enumeration).
   */
  async request(input: PasswordResetRequestInput): Promise<void> {
    const user = await this.users.findIdByEmail(input.email);
    if (!user) return; // unknown email — succeed silently

    // Only one active reset token per user.
    await this.tokens.deleteAllForUser(user.id);

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000);
    await this.tokens.create({ userId: user.id, tokenHash: hashToken(rawToken), expiresAt });

    const resetUrl = `${this.webOrigin}/reset-password?token=${rawToken}`;
    await this.mail.send({ to: input.email, ...passwordResetEmail(resetUrl, this.ttlMinutes) });
  }

  /** Set a new password if the token is valid, unused, and unexpired. */
  async confirm(input: PasswordResetConfirmInput): Promise<void> {
    const row = await this.tokens.findByHash(hashToken(input.token));
    if (!row || row.usedAt !== null || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const passwordHash = await this.passwords.hash(input.password);
    await this.users.updatePasswordHash(row.userId, passwordHash);
    await this.tokens.markUsed(row.id);
  }
}
