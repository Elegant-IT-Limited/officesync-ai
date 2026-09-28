import { Module } from '@nestjs/common';
import { ReviewModule } from '../review/review.module';
import { FollowupsService } from './followups.service';

@Module({ imports: [ReviewModule], providers: [FollowupsService], exports: [FollowupsService] })
export class FollowupsModule {}
