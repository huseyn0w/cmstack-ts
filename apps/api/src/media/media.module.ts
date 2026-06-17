import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageModule } from './storage.module';

@Module({
  // AccountsModule provides the auth guards; StorageModule provides STORAGE.
  imports: [AccountsModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
