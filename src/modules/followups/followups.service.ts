import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { localDate } from '../../core/dates';
import type { TenantCtx } from '../../core/tenancy';
import { ReviewService } from '../review/review.service';

export interface ThreadMessage { id: string; from: string; sentAt: Date; needsReply: boolean }

/** Whole working days between two instants in a time zone, not counting Saturdays and Sundays. */
export function workingDaysBetween(a: Date, b: Date, timeZone: string): number {
  const toDay = (x: Date) => { const { y, m, d } = localDate(x, timeZone); return Date.UTC(y, m - 1, d); };
  let n = 0;
  for (let t = toDay(a) + 86_400_000; t <= toDay(b); t += 86_400_000) { const dow = new Date(t).getUTCDay(); if (dow !== 0 && dow !== 6) n++; }
  return n;
}

/**
 * A thread has gone quiet when the last message came from someone on the team, triage
 * judged that it expected an answer, and nobody else has written since, for longer
 * than the workspace allows. No model call: triage already answered the only
 * question that needed language understanding when the message was sent.
 */
export function quietThread(
  messages: ThreadMessage[], teamEmails: string[], now: Date, timeZone: string, afterWorkingDays = 2,
): { waitingOn: string; since: Date; days: number } | null {
  const sorted = [...messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const last = sorted[sorted.length - 1];
  if (!last || !teamEmails.includes(last.from) || !last.needsReply) return null;
  const days = workingDaysBetween(last.sentAt, now, timeZone);
  if (days < afterWorkingDays) return null;
  const counterpart = [...sorted].reverse().find((m) => !teamEmails.includes(m.from));
  return { waitingOn: counterpart?.from ?? 'recipient', since: last.sentAt, days };
}

@Injectable()
export class FollowupsService {
  constructor(@Inject(ReviewService) private readonly review: ReviewService) {}

  /**
   * Called by the follow-up check for each tracked thread. A quiet thread becomes one
   * reminder suggestion in the review queue, keyed on the message that is waiting, so
   * running the check again tomorrow does not queue a second reminder for it.
   */
  async check(ctx: TenantCtx, conversationId: string, messages: ThreadMessage[], teamEmails: string[], afterWorkingDays = 2) {
    const quiet = quietThread(messages, teamEmails, ctx.now, ctx.timeZone, afterWorkingDays);
    if (!quiet) return null;
    const last = [...messages].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0]!;
    const queued = await this.review.propose([{
      tenantId: ctx.tenantId, type: 'reminder', evidence: null, flags: [],
      dedupKey: createHash('sha256').update(`${ctx.tenantId}|reminder|${conversationId}|${last.id}`).digest('hex'),
      payload: { conversationId, messageId: last.id, waitingOn: quiet.waitingOn, since: quiet.since.toISOString(), workingDays: quiet.days },
    }]);
    return { ...quiet, queued: queued.length === 1 };
  }
}
