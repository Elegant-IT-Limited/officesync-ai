const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** The calendar date an instant falls on in a time zone, as y/m/d. */
export function localDate(instant: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

const iso = (dt: Date) => dt.toISOString().slice(0, 10);
const addDays = (dt: Date, n: number) => new Date(dt.getTime() + n * 86_400_000);

/**
 * Turns the phrase a person wrote ("by Friday", "end of week", "Oct 3") into a date,
 * relative to when the message was sent and in the sender's workspace time zone.
 *
 * Deliberately not a model's job. Models are unreliable at calendar arithmetic, and
 * "tomorrow" in a message sent at 22:30 in New York is a different UTC day. Returns
 * null for anything it cannot resolve with certainty, and the task keeps the phrase.
 */
export function resolveDue(phrase: string | null, sentAt: Date, timeZone: string): string | null {
  if (!phrase) return null;
  const p = phrase.toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  const { y, m, d } = localDate(sentAt, timeZone);
  const base = new Date(Date.UTC(y, m - 1, d));
  const dow = base.getUTCDay();

  if (/\b(today|tonight|eod|end of (the )?day|cob)\b/.test(p)) return iso(base);
  if (/\btomorrow\b/.test(p)) return iso(addDays(base, 1));
  if (/\bend of (the |this )?week\b|\beow\b/.test(p)) return iso(addDays(base, dow === 6 ? 6 : 5 - dow)); // that week's Friday
  if (/\bend of (the |this )?month\b/.test(p)) return iso(new Date(Date.UTC(y, m, 0)));
  const inDays = p.match(/\bin (\d{1,2}) days?\b/);
  if (inDays) return iso(addDays(base, Number(inDays[1])));

  const weekday = DAYS.findIndex((day) => new RegExp(`\\b${day}\\b`).test(p));
  if (weekday >= 0) {
    if (new RegExp(`\\bnext ${DAYS[weekday]}\\b`).test(p)) return null; // "next Tuesday" means different days to different people
    if (/\bnext week\b/.test(p)) return iso(addDays(base, ((8 - dow) % 7 || 7) + ((weekday + 6) % 7)));
    return iso(addDays(base, (weekday - dow + 7) % 7 || 7)); // a bare weekday is the next one, never today
  }
  if (/\bnext week\b/.test(p)) return iso(addDays(base, (8 - dow) % 7 || 7));

  const md = p.match(new RegExp(`\\b(${MONTHS.map((x) => x.slice(0, 3)).join('|')})[a-z]* (\\d{1,2})\\b|\\b(\\d{1,2}) (${MONTHS.map((x) => x.slice(0, 3)).join('|')})[a-z]*\\b`));
  if (md) {
    const month = MONTHS.findIndex((x) => x.startsWith(md[1] ?? md[4] ?? ''));
    const day = Number(md[2] ?? md[3]);
    let date = new Date(Date.UTC(y, month, day));
    if (date.getUTCMonth() !== month) return null;         // "Feb 30"
    if (date < base) date = new Date(Date.UTC(y + 1, month, day)); // "Jan 5" written in December
    return iso(date);
  }
  const isoMatch = p.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  return null;
}
