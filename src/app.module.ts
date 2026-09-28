import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CoreModule, type CoreOptions } from './core/core.module';
import { DomainErrorFilter } from './core/errors';
import { FollowupsModule } from './modules/followups/followups.module';
import { MailModule } from './modules/mail/mail.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { ReviewModule } from './modules/review/review.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';

/**
 * The one place feature modules are registered. Adding a lane is one import here;
 * the workers module is added by main.ts only, so tests never need Redis.
 */
export const FEATURE_MODULES = [MailModule, MeetingsModule, FollowupsModule, SchedulingModule, ReviewModule];

@Module({})
export class AppModule {
  static forRoot(core: CoreOptions, extra: DynamicModule[] = []): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.forRoot(core), ...FEATURE_MODULES, ...extra],
      providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
    };
  }
}
