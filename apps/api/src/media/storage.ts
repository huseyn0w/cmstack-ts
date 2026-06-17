/**
 * Storage abstraction for uploaded files. The default implementation writes to
 * local disk; swapping in an S3/object-storage driver is a one-line provider
 * change in StorageModule (the rest of the app depends only on this interface).
 */
export interface StorageDriver {
  /** Persist `data` under `key`. */
  save(key: string, data: Buffer): Promise<void>;
  /** Remove the file at `key` (no-op if absent). */
  delete(key: string): Promise<void>;
  /** Absolute filesystem path for a key (used to serve local files). */
  pathFor(key: string): string;
  /** Root directory/prefix files live under. */
  readonly root: string;
}

export const STORAGE = Symbol('STORAGE');
