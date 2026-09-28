import { AlreadyDecided, NotAcceptableHere, NotFound } from '../../../src/core/errors';
import { signSession } from '../../../src/core/session.guard';
import type { TaskWriter } from '../../../src/integrations/officesyncpro/tasks.client';
import { MailService } from '../../../src/modules/mail/mail.service';
import { ReviewService } from '../../../src/modules/review/review.service';
import { aiSuggestions } from '../../../src/modules/review/review.table';
import { SESSION_SECRET, testApp, testServer } from '../../support/app';
import { clientThread, ctx, DANA, OTHER_TENANT } from '../../support/fixtures';
import { fakeOpenRouter } from '../../support/recorded';

const WIREFRAMES = 'Send revised homepage wireframes to Megan';
let created: any[];
const tasks: TaskWriter = { async create(input) { created.push(input); return { id: `9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c${String(created.length).padStart(2, '0')}` }; } };

// Each test starts with the three task suggestions the client email produces. They are
// inserted in one statement and share a timestamp, so tests pick rows by title, not order.
async function queue(app?: Awaited<ReturnType<typeof testApp>>) {
  created = [];
  app ??= await testApp({ fetch: fakeOpenRouter().fetch, tasks });
  await app.get(MailService).processEmail(ctx(), clientThread);
  const rows = await app.db.select().from(aiSuggestions);
  const byTitle = (t: string) => rows.find((r) => (r.payload as { title: string }).title === t)!;
  return { review: app.get(ReviewService), rows, byTitle, tenantId: ctx().tenantId };
}

describe('the review queue', () => {
  it('creates the task only on accept, carrying the owner, date and the source sentence', async () => {
    const { review, byTitle, tenantId } = await queue();
    await review.accept(tenantId, byTitle(WIREFRAMES).id, DANA.id);
    expect(created).toEqual([{ tenantId, title: WIREFRAMES, assigneeId: DANA.id, dueDate: '2026-09-25', sourceQuote: 'Could you send the revised homepage wireframes by Friday?' }]);
  });

  it('applies the edits a person makes before accepting', async () => {
    const { review, byTitle, tenantId } = await queue();
    await review.accept(tenantId, byTitle(WIREFRAMES).id, DANA.id, { dueDate: '2026-09-24', title: 'Send homepage wireframes v2 to Megan' });
    expect(created[0]).toMatchObject({ title: 'Send homepage wireframes v2 to Megan', dueDate: '2026-09-24' });
  });

  it('is idempotent on a double click, and a dismissed suggestion cannot come back', async () => {
    const { review, rows, tenantId } = await queue();
    const [a, b] = rows;
    const one = await review.accept(tenantId, a!.id, DANA.id);
    const two = await review.accept(tenantId, a!.id, DANA.id);
    expect(two).toEqual(one);
    expect(created.length).toBe(1);
    await review.dismiss(tenantId, b!.id, DANA.id);
    await expect(review.accept(tenantId, b!.id, DANA.id)).rejects.toBeInstanceOf(AlreadyDecided);
    await expect(review.dismiss(tenantId, a!.id, DANA.id)).rejects.toBeInstanceOf(AlreadyDecided);
  });

  it('another workspace cannot see or accept it', async () => {
    const { review, rows } = await queue();
    await expect(review.accept(OTHER_TENANT, rows[0]!.id, DANA.id)).rejects.toBeInstanceOf(NotFound);
    expect(created.length).toBe(0);
  });

  it('refuses to accept a suggestion that is not a task instead of creating a half-empty one', async () => {
    const { review, tenantId } = await queue();
    const [summary] = await review.propose([{ tenantId, type: 'summary', dedupKey: 'summary-1', evidence: null, flags: [], payload: { summary: 'Kickoff notes.' } }]);
    await expect(review.accept(tenantId, summary!.id, DANA.id)).rejects.toBeInstanceOf(NotAcceptableHere);
    expect(created.length).toBe(0);
  });
});

describe('the review routes', () => {
  it('take the tenant and user from the signed session, and reject anything else', async () => {
    const server = await testServer({ fetch: fakeOpenRouter().fetch, tasks });
    const { byTitle, tenantId } = await queue(server);
    const as = (tenant: string) => ({ authorization: `Bearer ${signSession({ tenantId: tenant, userId: DANA.id }, SESSION_SECRET)}`, 'content-type': 'application/json' });
    const accept = (id: string, headers: Record<string, string>, body: unknown = {}) =>
      fetch(`${server.url}/api/internal/suggestions/${id}/accept`, { method: 'POST', headers, body: JSON.stringify(body) });

    expect((await fetch(`${server.url}/api/internal/suggestions`, { headers: { authorization: `Bearer ${tenantId}:${DANA.id}.forged` } })).status).toBe(401);
    expect((await accept(byTitle(WIREFRAMES).id, as(tenantId), { tenantId: OTHER_TENANT })).status).toBe(400); // a smuggled field
    expect((await accept(byTitle(WIREFRAMES).id, as(OTHER_TENANT))).status).toBe(404);
    const ok = await accept(byTitle(WIREFRAMES).id, as(tenantId), { dueDate: '2026-09-24' });
    expect(ok.status).toBe(201);
    expect(created).toEqual([expect.objectContaining({ tenantId, assigneeId: DANA.id, dueDate: '2026-09-24' })]);
  });
});
