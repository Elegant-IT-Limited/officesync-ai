import { z } from 'zod';

// Names and the time window come back exactly as written. Turning "Omar" into a person
// and "next week" into dates happens in code, against the directory and the calendar.
export const SchedulingAsk = z.object({
  attendees: z.array(z.string()).min(1).max(10),
  duration_minutes: z.number().int().min(15).max(240),
  window_text: z.string().nullable(),
  part_of_day: z.enum(['any', 'morning', 'afternoon']),
  title: z.string().max(80),
});

export const SCHEDULING_PROMPT = `Read a request to find a meeting time. attendees: every person to invite, as written (names or addresses).
duration_minutes: the length asked for, 30 if not stated. window_text: when, as written ("next week"), else null.
part_of_day: morning or afternoon only if the request says so. title: a short meeting title.`;
