import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ReviewModule } from '../review/review.module';
import { SchedulingService } from './scheduling.service';

@Module({ imports: [AiModule, ReviewModule], providers: [SchedulingService], exports: [SchedulingService] })
export class SchedulingModule {}
