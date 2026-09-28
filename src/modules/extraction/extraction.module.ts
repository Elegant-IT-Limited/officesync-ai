import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ExtractionService } from './extraction.service';

@Module({ imports: [AiModule], providers: [ExtractionService], exports: [ExtractionService] })
export class ExtractionModule {}
