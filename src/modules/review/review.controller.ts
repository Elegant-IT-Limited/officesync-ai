import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentSession, SessionGuard, type Session } from '../../core/session.guard';
import { ZodPipe } from '../../core/zod.pipe';
import { AcceptBody } from './review.dto';
import { ReviewService } from './review.service';

/** Review queue routes for the webapp. Thin: validate, call the service, return. */
@Controller('api/internal/suggestions')
@UseGuards(SessionGuard)
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly review: ReviewService) {}

  @Get()
  pending(@CurrentSession() s: Session) {
    return this.review.pending(s.tenantId);
  }

  @Post(':id/accept')
  accept(@CurrentSession() s: Session, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(AcceptBody)) edits: AcceptBody) {
    return this.review.accept(s.tenantId, id, s.userId, edits);
  }

  @Post(':id/dismiss')
  @HttpCode(204)
  dismiss(@CurrentSession() s: Session, @Param('id', ParseUUIDPipe) id: string) {
    return this.review.dismiss(s.tenantId, id, s.userId);
  }
}
