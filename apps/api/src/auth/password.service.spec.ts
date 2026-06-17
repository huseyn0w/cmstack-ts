import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('produces a verifiable Argon2id hash', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await service.verify(hash, 'correct horse battery staple')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('s3cret-password');
    expect(await service.verify(hash, 'wrong-password')).toBe(false);
  });

  it('returns false (never throws) for a malformed hash', async () => {
    expect(await service.verify('not-a-hash', 'whatever')).toBe(false);
  });

  it('salts: hashing the same password twice yields different hashes', async () => {
    const a = await service.hash('same-password');
    const b = await service.hash('same-password');
    expect(a).not.toBe(b);
  });
});
