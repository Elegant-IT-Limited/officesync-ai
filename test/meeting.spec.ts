import { openDb, type DB } from '../src/ai/db';
import { parseVtt, summariseMeeting } from '../src/ai/meeting';
import { ctx, DANA, kickoffVtt, OMAR, PRIYA } from './fixtures';
import { fakeOpenRouter } from './recorded';

let db: DB;
beforeEach(async () => { db = await openDb(); });
const started = new Date('2026-09-22T15:00:00Z'); // Tuesday 11:00 in New York

describe('a Teams meeting transcript', () => {
  it('parses WebVTT voice tags into speaker turns', () => {
    const turns = parseVtt(kickoffVtt);
    expect(turns.length).toBe(7);
    expect(turns[0]).toEqual({ speaker: 'Dana Whitfield', text: "Okay, let's lock phase 2. The main open item is the homepage.", at: '00:00:04' });
  });

  it('returns a summary, the decisions it can prove, and owned action items with dates', async () => {
    const r = await summariseMeeting({ db, fetch: fakeOpenRouter().fetch, apiKey: 'k' }, ctx(), 'mtg-kickoff', kickoffVtt, [DANA, OMAR, PRIYA], started);
    expect(r.decisions.map((d) => d.text)).toEqual(['The homepage hero leads with the booking flow.', 'The blog migration moves to phase 3.']);
    expect(r.actions.map((a) => [a.ownerId, a.due])).toEqual([[PRIYA.id, '2026-09-25'], [OMAR.id, null], [DANA.id, '2026-09-23']]);
  });

  it('drops a decision nobody said: the launch date never came up', async () => {
    const r = await summariseMeeting({ db, fetch: fakeOpenRouter().fetch, apiKey: 'k' }, ctx(), 'mtg-kickoff', kickoffVtt, [DANA, OMAR, PRIYA], started);
    expect(r.dropped).toEqual(['decision: Launch date stays at 14 November.']);
  });
});

describe('queueing a meeting', () => {
  it('puts the summary and every action item in the review queue, once', async () => {
    const { queueMeeting } = await import('../src/ai/meeting');
    const r = await summariseMeeting({ db, fetch: fakeOpenRouter().fetch, apiKey: 'k' }, ctx(), 'mtg-kickoff', kickoffVtt, [DANA, OMAR, PRIYA], started);
    expect(await queueMeeting(db, ctx(), 'mtg-kickoff', r)).toBe(4);
    expect(await queueMeeting(db, ctx(), 'mtg-kickoff', r)).toBe(0);
  });
});
