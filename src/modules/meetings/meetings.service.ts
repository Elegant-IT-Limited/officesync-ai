import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { resolveDue } from '../../core/dates';
import type { Member, TenantCtx } from '../../core/tenancy';
import { normalise } from '../../core/text';
import { AiService } from '../ai/ai.service';
import { ReviewService } from '../review/review.service';
import { MEETING_PROMPT, MeetingNotes } from './meetings.contract';
import { parseVtt } from './vtt';

export interface MeetingResult {
  summary: string;
  decisions: { text: string; quote: string }[];
  actions: { title: string; ownerId: string | null; due: string | null; quote: string; flags: string[]; dedupKey: string }[];
  dropped: string[];
}

/**
 * A spoken name to one attendee, or to nobody. "Priya" matches when exactly one
 * attendee is called Priya; two Sams means no owner and a flag, never a coin toss.
 */
export function matchAttendee(name: string | null, attendees: Member[]): Member | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const full = attendees.filter((a) => a.name.toLowerCase() === n);
  if (full.length === 1) return full[0]!;
  const first = attendees.filter((a) => a.name.toLowerCase().split(' ')[0] === n.split(' ')[0]);
  return first.length === 1 ? first[0]! : null;
}

const key = (ctx: TenantCtx, meetingId: string, part: string) =>
  createHash('sha256').update(`${ctx.tenantId}|meeting:${meetingId}|${part}`).digest('hex');

@Injectable()
export class MeetingsService {
  constructor(@Inject(AiService) private readonly ai: AiService, @Inject(ReviewService) private readonly review: ReviewService) {}

  async summarise(ctx: TenantCtx, meetingId: string, vtt: string, attendees: Member[], startedAt: Date): Promise<MeetingResult> {
    const turns = parseVtt(vtt);
    const numbered = turns.map((t, i) => `[${i + 1}] ${t.speaker}: ${t.text}`).join('\n');
    const { data } = await this.ai.complete(ctx, 'meeting', MeetingNotes, MEETING_PROMPT, numbered);
    // Same rule as email: a decision or an action item survives only if its quote
    // was actually said. Summaries are where models most like to add a tidy
    // conclusion nobody reached.
    const said = normalise(turns.map((t) => t.text).join(' '));
    const dropped: string[] = [];

    const decisions = data.decisions.filter((d) => said.includes(normalise(d.quote)) || (dropped.push(`decision: ${d.text}`), false));
    const actions = data.action_items.flatMap((a) => {
      if (!said.includes(normalise(a.quote))) { dropped.push(`action: ${a.title}`); return []; }
      const owner = matchAttendee(a.owner_name, attendees);
      // deadlines in a meeting are relative to when it happened, not when it was processed
      const due = resolveDue(a.due_text, startedAt, ctx.timeZone);
      const flags = [...(a.owner_name && !owner ? ['owner_unmatched'] : []), ...(a.due_text && !due ? ['due_unresolved'] : [])];
      return [{ title: a.title, ownerId: owner?.id ?? null, due, quote: a.quote, flags, dedupKey: key(ctx, meetingId, normalise(a.quote)) }];
    });
    return { summary: data.summary, decisions, actions, dropped };
  }

  /** Puts the summary and the action items in the review queue, like everything else the pipeline produces. */
  async queue(ctx: TenantCtx, meetingId: string, r: MeetingResult): Promise<number> {
    const inserted = await this.review.propose([
      { tenantId: ctx.tenantId, type: 'summary', dedupKey: key(ctx, meetingId, 'summary'), evidence: null, flags: [], payload: { summary: r.summary, decisions: r.decisions } },
      ...r.actions.map((a) => ({
        tenantId: ctx.tenantId, type: 'task' as const, dedupKey: a.dedupKey, evidence: a.quote, flags: a.flags,
        payload: { title: a.title, ownerId: a.ownerId, due: a.due, quote: a.quote },
      })),
    ]);
    return inserted.length;
  }
}
