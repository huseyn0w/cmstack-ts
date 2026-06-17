import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing with Argon2id (memory-hard, the OWASP-recommended default).
 * @node-rs/argon2 ships prebuilt native binaries, so there is no node-gyp build.
 */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(passwordHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plain);
    } catch {
      // Malformed hash, etc. — treat as a failed verification, never throw.
      return false;
    }
  }
}
