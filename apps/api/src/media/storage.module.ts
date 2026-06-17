import { Global, Module } from '@nestjs/common';
import { parseEnv } from '@typress/config';
import { LocalStorageService } from './local-storage.service';
import { STORAGE } from './storage';

/**
 * Binds the StorageDriver. Today it is local disk; to use object storage, swap
 * the factory for an S3 driver — nothing else in the app changes.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      useFactory: () => new LocalStorageService(parseEnv().UPLOAD_DIR),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
