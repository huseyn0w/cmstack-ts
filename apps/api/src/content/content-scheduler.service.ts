import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PagesService } from './pages.service';
import { PostsService } from './posts.service';

/**
 * Once-a-minute worker that auto-publishes due scheduled drafts. The interval is
 * a thin, fault-isolated trigger; all logic lives in the services.
 */
@Injectable()
export class ContentSchedulerService {
  private readonly logger = new Logger('ContentScheduler');

  constructor(
    private readonly posts: PostsService,
    private readonly pages: PagesService,
  ) {}

  @Interval(60_000)
  async runDuePublish(): Promise<void> {
    const now = new Date();
    try {
      const published = (await this.posts.publishDue(now)) + (await this.pages.publishDue(now));
      if (published > 0) this.logger.log(`Auto-published ${published} scheduled item(s)`);
    } catch (error) {
      this.logger.error('Scheduled publish run failed', error as Error);
    }
  }
}
