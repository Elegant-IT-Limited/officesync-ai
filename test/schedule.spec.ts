import { openDb, type DB } from '../src/ai/db';
import { proposeSlots, type GraphCalendar } from '../src/ai/schedule';
import { ctx, DANA, OMAR, PRIYA } from './fixtures';
import { fakeOpenRouter, GRAPH_SUGGESTIONS } from './recorded';

let db: DB;
beforeEach(async () => { db = await openDb(); });
function graph() {
  const requests: any[] = [];
  const g: GraphCalendar = { async findMeetingTimes(body) { requests.push(body); return GRAPH_SUGGESTIONS; } };
  return { g, requests };
}

describe('scheduling from plain language', () => {
  it('asks Graph for free time next week and offers only slots Graph returned', async () => {
    const { g, requests } = graph();
    const r = await proposeSlots({ db, fetch: fakeOpenRouter().fetch, apiKey: 'k', graph: g }, ctx(),
      'Also, can we find 30 minutes next week with you and Omar to review the timeline?', DANA);
    expect(r.status).toBe('slots');
    if (r.status !== 'slots') return;
    expect(r.attendees).toEqual([OMAR]);
    expect(r.slots.map((s) => s.start.dateTime)).toEqual(['2026-09-28T14:00:00.0000000', '2026-09-29T10:00:00.0000000', '2026-10-01T15:30:00.0000000']);
    const returned = GRAPH_SUGGESTIONS.meetingTimeSuggestions.map((s) => s.meetingTimeSlot.start.dateTime);
    expect(r.slots.every((s) => returned.includes(s.start.dateTime))).toBe(true);
    expect(requests[0].meetingDuration).toBe('PT30M');
    expect(requests[0].timeConstraint.timeSlots.map((t: any) => t.start.dateTime.slice(0, 10))).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('narrows the window to mornings when the request says so', async () => {
    const { g, requests } = graph();
    await proposeSlots({ db, fetch: fakeOpenRouter().fetch, apiKey: 'k', graph: g }, ctx(), '45 minutes with Omar and Priya next week, mornings if possible', DANA);
    expect(requests[0].attendees.map((a: any) => a.emailAddress.address)).toEqual([OMAR.email, PRIYA.email]);
    expect(requests[0].timeConstraint.timeSlots[0]).toEqual({ start: { dateTime: '2026-09-28T09:00:00', timeZone: 'Eastern Standard Time' }, end: { dateTime: '2026-09-28T12:00:00', timeZone: 'Eastern Standard Time' } });
  });

  it('asks which Sam instead of guessing, and never calls Graph', async () => {
    const { g, requests } = graph();
    const r = await proposeSlots({ db, fetch: fakeOpenRouter().fetch, apiKey: 'k', graph: g }, ctx(), 'Set up 30 minutes tomorrow with Sam', DANA);
    expect(r).toMatchObject({ status: 'clarify', name: 'Sam' });
    if (r.status === 'clarify') expect(r.candidates.map((c) => c.name)).toEqual(['Sam Ortiz', 'Sam Kessler']);
    expect(requests.length).toBe(0);
  });
});
