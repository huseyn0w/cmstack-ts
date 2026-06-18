import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { PublicSeoController } from './public-seo.controller';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // SEO controller.
  imports: [AccountsModule],
  controllers: [SeoController, PublicSeoController],
  providers: [SeoService],
})
export class SeoModule {}
