import { createHash } from 'node:crypto';
import { z } from 'zod';
import { resolveDue } from './due-date';
import { complete, type ModelDeps } from './openrouter';
import { normalise } from './prepare';
import type { Ctx, Member } from './types';

export interface Turn { speaker: string; text: string; at: string }

/** Teams transcripts arrive from Graph as WebVTT with <v Speaker> voice tags. Consecutive cues by one speaker become one turn. */
export function parseVtt(vtt: string): Turn[] {
  const turns: Turn[] = [];
  const cue = /(\d{2}:\d{2}:\d{2})\.\d{3} --> [^\n]+\n<v ([^>]+)>([\s\S]*?)<\/v>/g;
  for (const m of vtt.matchAll(cue)) {
    const [, at, speaker, text] = m as unknown as [string, string, string, string];
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) last.text += ' ' + text.trim();
    else turns.push({ speaker, text: text.trim(), at });
  }
  return turns;
}

export const MeetingNotes = z.object({
  summary: z.string().max(700),
  decisions: z.array(z.object({ text: z.string().max(200), quote: z.string().min(8) })).max(8),
  action_items: z.array(z.object({
    title: z.string().min(3).max(90), owner_name: z.string().nullable(), due_text: z.string().nullable(), quote: z.string().min(8),
  })).max(12),
});

const SYSTEM = `You are given a meeting transcript as numbered speaker turns.
summary: what the meeting covered and where it landed, in plain sentences, under 700 characters.
decisions: things the group agreed, each with the exact words from the transcript that show it.
action_items: work someone took on or was given, with the owner's name as spoken, the deadline as spoken, and the exact words.`;

export interface MeetingResult {
  summary: string;
  decisions: { text: string; quote: string }[];
  actions: { title: string; ownerId: string | null; due: string | null; quote: string; flags: string[]; dedupKey: string }[];
  dropped: string[];
}

function matchAttendee(name: string | null, attendees: Member[]): Member | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const full = attendees.filter((a) => a.name.toLowerCase() === n);
  if (full.length === 1) return full[0]!;
  const first = attendees.filter((a) => a.name.toLowerCase().split(' ')[0] === n.split(' ')[0]);
  return first.length === 1 ? first[0]! : null;
}

export async function summariseMeeting(
  deps: ModelDeps, ctx: Ctx, meetingId: string, vtt: string, attendees: Member[], startedAt: Date,
): Promise<MeetingResult> {
  const turns = parseVtt(vtt);
  const numbered = turns.map((t, i) => `[${i + 1}] ${t.speaker}: ${t.text}`).join('\n');
  const { data } = await complete(deps, ctx, 'meeting', MeetingNotes, SYSTEM, numbered);
  const said = normalise(turns.map((t) => t.text).join(' '));
  const dropped: string[] = [];

  const decisions = data.decisions.filter((d) => said.includes(normalise(d.quote)) || (dropped.push(`decision: ${d.text}`), false));
  const actions = data.action_items.flatMap((a) => {
    if (!said.includes(normalise(a.quote))) { dropped.push(`action: ${a.title}`); return []; }
    const owner = matchAttendee(a.owner_name, attendees);
    const due = resolveDue(a.due_text, startedAt, ctx.timeZone);
    const flags = [...(a.owner_name && !owner ? ['owner_unmatched'] : []), ...(a.due_text && !due ? ['due_unresolved'] : [])];
    const dedupKey = createHash('sha256').update(`${ctx.tenantId}|meeting:${meetingId}|${normalise(a.quote)}`).digest('hex');
    return [{ title: a.title, ownerId: owner?.id ?? null, due, quote: a.quote, flags, dedupKey }];
  });
  return { summary: data.summary, decisions, actions, dropped };
}

/** Puts the meeting's summary and action items in the review queue, like everything else the pipeline produces. */
export async function queueMeeting(db: import('./db').DB, ctx: Ctx, meetingId: string, r: MeetingResult): Promise<number> {
  const { aiSuggestions } = await import('./schema');
  const rows = [
    { type: 'summary' as const, dedupKey: createHash('sha256').update(`${ctx.tenantId}|meeting:${meetingId}|summary`).digest('hex'), evidence: null, flags: [] as string[], payload: { summary: r.summary, decisions: r.decisions } },
    ...r.actions.map((a) => ({ type: 'task' as const, dedupKey: a.dedupKey, evidence: a.quote, flags: a.flags, payload: { title: a.title, ownerId: a.ownerId, due: a.due, quote: a.quote } })),
  ];
  const inserted = await db.insert(aiSuggestions).values(rows.map((x) => ({ tenantId: ctx.tenantId, ...x }))).onConflictDoNothing().returning({ id: aiSuggestions.id });
  return inserted.length;
}
