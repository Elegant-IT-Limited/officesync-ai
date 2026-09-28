import type { GraphCalendar } from '../../../src/integrations/microsoft-graph/graph-calendar.client';
import { aiSuggestions } from '../../../src/modules/review/review.table';
import { SchedulingService } from '../../../src/modules/scheduling/scheduling.service';
import { testApp } from '../../support/app';
import { ctx, DANA, OMAR, PRIYA } from '../../support/fixtures';
import { fakeOpenRouter, GRAPH_SUGGESTIONS } from '../../support/recorded';

async function scheduling() {
  const requests: any[] = [];
  const graph: GraphCalendar = { async findMeetingTimes(_organizer, body) { requests.push(body); return GRAPH_SUGGESTIONS; } };
  const app = await testApp({ fetch: fakeOpenRouter().fetch, graph });
  return { service: app.get(SchedulingService), requests, db: app.db };
}

describe('scheduling from plain language', () => {
  it('asks Graph for free time next week and offers only slots Graph returned', async () => {
    const { service, requests, db } = await scheduling();
    const r = await service.proposeSlots(ctx(), 'Also, can we find 30 minutes next week with you and Omar to review the timeline?', DANA);
    expect((await db.select().from(aiSuggestions)).map((s) => s.type)).toEqual(['slots']); // an offer in the queue, not an invite
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
    const { service, requests } = await scheduling();
    await service.proposeSlots(ctx(), '45 minutes with Omar and Priya next week, mornings if possible', DANA);
    expect(requests[0].attendees.map((a: any) => a.emailAddress.address)).toEqual([OMAR.email, PRIYA.email]);
    expect(requests[0].timeConstraint.timeSlots[0]).toEqual({ start: { dateTime: '2026-09-28T09:00:00', timeZone: 'Eastern Standard Time' }, end: { dateTime: '2026-09-28T12:00:00', timeZone: 'Eastern Standard Time' } });
  });

  it('asks which Sam instead of guessing, and never calls Graph', async () => {
    const { service, requests } = await scheduling();
    const r = await service.proposeSlots(ctx(), 'Set up 30 minutes tomorrow with Sam', DANA);
    expect(r).toMatchObject({ status: 'clarify', name: 'Sam' });
    if (r.status === 'clarify') expect(r.candidates.map((c) => c.name)).toEqual(['Sam Ortiz', 'Sam Kessler']);
    expect(requests.length).toBe(0);
  });
});
