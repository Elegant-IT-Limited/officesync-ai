import { Injectable } from '@nestjs/common';
import { localDate } from '../../core/dates';

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
  /** Called by the follow-up check for each tracked thread; a non-null result becomes a reminder suggestion. */
  check(messages: ThreadMessage[], teamEmails: string[], now: Date, timeZone: string, afterWorkingDays = 2) {
    return quietThread(messages, teamEmails, now, timeZone, afterWorkingDays);
  }
}
