import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let dir: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'typress-storage-'));
    storage = new LocalStorageService(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves and reads back a file', async () => {
    await storage.save('hello.txt', Buffer.from('hi there'));
    expect(await readFile(storage.pathFor('hello.txt'), 'utf8')).toBe('hi there');
  });

  it('deletes a file', async () => {
    await storage.save('gone.txt', Buffer.from('x'));
    await storage.delete('gone.txt');
    expect(existsSync(storage.pathFor('gone.txt'))).toBe(false);
  });

  it('does not throw when deleting a missing file', async () => {
    await expect(storage.delete('nope.txt')).resolves.toBeUndefined();
  });

  it('prevents path traversal by reducing keys to a basename', () => {
    const target = storage.pathFor('../../etc/passwd');
    expect(target).toBe(join(dir, 'passwd'));
  });
});
