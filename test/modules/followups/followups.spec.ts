import { FollowupsService, quietThread, workingDaysBetween } from '../../../src/modules/followups/followups.service';
import { aiSuggestions } from '../../../src/modules/review/review.table';
import { testApp } from '../../support/app';
import { ctx } from '../../support/fixtures';
import { fakeOpenRouter } from '../../support/recorded';

const team = ['dana@brightline.example', 'omar@brightline.example'];
const tz = 'America/New_York';
const asked = { id: 'm2', from: 'dana@brightline.example', sentAt: new Date('2026-09-18T19:30:00Z'), needsReply: true }; // Fri 15:30
const earlier = { id: 'm1', from: 'megan@harlowpike.example', sentAt: new Date('2026-09-17T14:00:00Z'), needsReply: true };

describe('a thread that went quiet', () => {
  it('counts working days only, so a Friday question is 2 days old on Tuesday, not 4', () => {
    expect(workingDaysBetween(asked.sentAt, new Date('2026-09-22T15:00:00Z'), tz)).toBe(2);
  });

  it('suggests a reminder once the team has waited past the workspace limit', () => {
    const r = quietThread([earlier, asked], team, new Date('2026-09-22T15:00:00Z'), tz);
    expect(r).toEqual({ waitingOn: 'megan@harlowpike.example', since: asked.sentAt, days: 2 });
  });

  it('stays silent when the client has replied, or when nothing was asked', () => {
    const reply = { id: 'm3', from: 'megan@harlowpike.example', sentAt: new Date('2026-09-21T13:00:00Z'), needsReply: false };
    expect(quietThread([earlier, asked, reply], team, new Date('2026-09-22T15:00:00Z'), tz)).toBeNull();
    expect(quietThread([earlier, { ...asked, needsReply: false }], team, new Date('2026-09-22T15:00:00Z'), tz)).toBeNull();
  });

  it('does not nag early: one working day is not enough', () => {
    expect(quietThread([earlier, asked], team, new Date('2026-09-21T15:00:00Z'), tz)).toBeNull();
  });

  it('queues one reminder suggestion for a quiet thread, and only one however often the check runs', async () => {
    const app = await testApp({ fetch: fakeOpenRouter().fetch });
    const followups = app.get(FollowupsService);
    const w = ctx({ now: new Date('2026-09-22T15:00:00Z') });
    expect(await followups.check(w, 'AAQkAGI2THVSAAA=', [earlier, asked], team)).toMatchObject({ days: 2, queued: true });
    expect(await followups.check(w, 'AAQkAGI2THVSAAA=', [earlier, asked], team)).toMatchObject({ queued: false });
    const rows = await app.db.select().from(aiSuggestions);
    expect(rows.map((r) => [r.type, r.status])).toEqual([['reminder', 'pending']]);
  });
});
