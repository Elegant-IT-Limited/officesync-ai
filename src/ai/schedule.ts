import { z } from 'zod';
import { localDate } from './due-date';
import { complete, type ModelDeps } from './openrouter';
import type { Ctx, Member } from './types';

export const SchedulingAsk = z.object({
  attendees: z.array(z.string()).min(1).max(10),
  duration_minutes: z.number().int().min(15).max(240),
  window_text: z.string().nullable(),
  part_of_day: z.enum(['any', 'morning', 'afternoon']),
  title: z.string().max(80),
});

const SYSTEM = `Read a request to find a meeting time. attendees: every person to invite, as written (names or addresses).
duration_minutes: the length asked for, 30 if not stated. window_text: when, as written ("next week"), else null.
part_of_day: morning or afternoon only if the request says so. title: a short meeting title.`;

/** Graph's findMeetingTimes takes Windows zone names in its request body. */
const WINDOWS_ZONE: Record<string, string> = {
  'America/New_York': 'Eastern Standard Time', 'America/Chicago': 'Central Standard Time',
  'America/Denver': 'Mountain Standard Time', 'America/Los_Angeles': 'Pacific Standard Time', 'Europe/London': 'GMT Standard Time',
};

export interface GraphSlot { start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }
export interface GraphCalendar {
  findMeetingTimes(body: unknown, timeZone: string): Promise<{
    emptySuggestionsReason?: string;
    meetingTimeSuggestions: { confidence: number; meetingTimeSlot: GraphSlot; organizerAvailability: string }[];
  }>;
}

export type ScheduleResult =
  | { status: 'slots'; title: string; attendees: Member[]; external: string[]; slots: GraphSlot[] }
  | { status: 'clarify'; name: string; candidates: Member[] }
  | { status: 'none'; reason: string };

/** A name to one workspace member, or to nobody. Never a guess between two. */
export function resolvePerson(written: string, members: Member[]): Member | Member[] | null {
  const w = written.trim().toLowerCase();
  const byEmail = members.find((m) => m.email.toLowerCase() === w);
  if (byEmail) return byEmail;
  const byName = members.filter((m) => m.name.toLowerCase() === w);
  if (byName.length === 1) return byName[0]!;
  const byFirst = members.filter((m) => m.name.toLowerCase().split(' ')[0] === w);
  if (byFirst.length === 1) return byFirst[0]!;
  return byFirst.length > 1 ? byFirst : null;
}

/** Working-day window for a phrase, as local dates. Anything unrecognised means the next 5 working days. */
export function windowDays(text: string | null, now: Date, timeZone: string): string[] {
  const { y, m, d } = localDate(now, timeZone);
  const base = new Date(Date.UTC(y, m - 1, d));
  const dow = base.getUTCDay();
  const day = (n: number) => new Date(base.getTime() + n * 86_400_000);
  const workdays = (from: number, count: number) => {
    const out: string[] = [];
    for (let i = from; out.length < count; i++) { const dt = day(i); if (dt.getUTCDay() % 6 !== 0) out.push(dt.toISOString().slice(0, 10)); }
    return out;
  };
  const t = (text ?? '').toLowerCase();
  if (t.includes('next week')) return workdays(((8 - dow) % 7) || 7, 5);
  if (t.includes('tomorrow')) return workdays(1, 1);
  if (t.includes('this week')) { const left = Math.max(0, 5 - dow); return left ? workdays(1, left) : workdays(1, 5); }
  return workdays(1, 5);
}

/**
 * The model only reads the request. Who is free, and when, comes from Graph. A slot
 * that Graph did not return can never be offered, and an attendee the directory
 * cannot pin down stops the flow with a question instead of inviting the wrong Sam.
 */
export async function proposeSlots(
  deps: ModelDeps & { graph: GraphCalendar }, ctx: Ctx, request: string, organizer: Member,
): Promise<ScheduleResult> {
  const { data: ask } = await complete(deps, ctx, 'schedule', SchedulingAsk, SYSTEM,
    `Organizer: ${organizer.name} <${organizer.email}>. "you" and "me" refer to the organizer.\n\n${request}`);

  const attendees: Member[] = [];
  const external: string[] = [];
  for (const written of ask.attendees) {
    const hit = resolvePerson(written, ctx.members);
    if (Array.isArray(hit)) return { status: 'clarify', name: written, candidates: hit };
    if (hit) { if (hit.id !== organizer.id && !attendees.some((a) => a.id === hit.id)) attendees.push(hit); }
    else if (written.includes('@')) external.push(written.toLowerCase());
    else if (!['you', 'me'].includes(written.trim().toLowerCase())) return { status: 'clarify', name: written, candidates: [] };
  }

  const tz = WINDOWS_ZONE[ctx.timeZone] ?? 'UTC';
  const [from, to] = ask.part_of_day === 'morning' ? ['09:00', '12:00'] : ask.part_of_day === 'afternoon' ? ['13:00', '17:00'] : ['09:00', '17:00'];
  const res = await deps.graph.findMeetingTimes({
    attendees: attendees.map((a) => ({ type: 'required', emailAddress: { address: a.email, name: a.name } })),
    timeConstraint: {
      activityDomain: 'work',
      timeSlots: windowDays(ask.window_text, ctx.now, ctx.timeZone).map((date) => ({
        start: { dateTime: `${date}T${from}:00`, timeZone: tz }, end: { dateTime: `${date}T${to}:00`, timeZone: tz },
      })),
    },
    meetingDuration: `PT${ask.duration_minutes}M`,
    maxCandidates: 10,
    isOrganizerOptional: false,
    returnSuggestionReasons: true,
    minimumAttendeePercentage: 100,
  }, ctx.timeZone);

  const slots = res.meetingTimeSuggestions
    .filter((s) => s.organizerAvailability === 'free')
    .sort((a, b) => b.confidence - a.confidence || a.meetingTimeSlot.start.dateTime.localeCompare(b.meetingTimeSlot.start.dateTime))
    .slice(0, 3)
    .map((s) => s.meetingTimeSlot)
    .sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime));
  if (!slots.length) return { status: 'none', reason: res.emptySuggestionsReason || 'no_common_free_time' };
  return { status: 'slots', title: ask.title, attendees, external, slots };
}
