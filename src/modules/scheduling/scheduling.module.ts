import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SchedulingService } from './scheduling.service';

@Module({ imports: [AiModule], providers: [SchedulingService], exports: [SchedulingService] })
export class SchedulingModule {}
