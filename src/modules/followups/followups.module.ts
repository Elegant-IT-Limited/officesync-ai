import { Module } from '@nestjs/common';
import { FollowupsService } from './followups.service';

@Module({ providers: [FollowupsService], exports: [FollowupsService] })
export class FollowupsModule {}
