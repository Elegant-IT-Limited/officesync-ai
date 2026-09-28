import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { ReviewModule } from '../review/review.module';
import { MailRepository } from './mail.repository';
import { MailService } from './mail.service';

@Module({
  imports: [AiModule, ExtractionModule, ReviewModule],
  providers: [MailRepository, MailService],
  exports: [MailService],
})
export class MailModule {}
