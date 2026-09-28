import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { MailModule } from '../modules/mail/mail.module';
import { MAIL_QUEUE, MailNotificationProcessor } from './mail-notification.processor';

@Module({})
export class WorkersModule {
  static forRoot(redisUrl: string): DynamicModule {
    return {
      module: WorkersModule,
      imports: [
        BullModule.forRoot({ connection: { url: redisUrl } }),
        // 5 attempts with exponential backoff covers a provider outage of a few minutes
        BullModule.registerQueue({ name: MAIL_QUEUE, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } } }),
        MailModule,
      ],
      providers: [MailNotificationProcessor],
    };
  }
}
