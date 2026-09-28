import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ReviewModule } from '../review/review.module';
import { MeetingsService } from './meetings.service';

@Module({ imports: [AiModule, ReviewModule], providers: [MeetingsService], exports: [MeetingsService] })
export class MeetingsModule {}
