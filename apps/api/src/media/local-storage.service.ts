import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { StorageDriver } from './storage';

/**
 * Stores files on the local filesystem under a root directory. Keys are reduced
 * to their basename before joining the root, so a malicious key can never escape
 * the upload directory via path traversal.
 */
export class LocalStorageService implements StorageDriver {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  pathFor(key: string): string {
    return join(this.root, basename(key));
  }

  async save(key: string, data: Buffer): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
