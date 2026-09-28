import { eq } from 'drizzle-orm';
import { aiCalls } from '../../../src/modules/ai/ai.table';
import { MailService } from '../../../src/modules/mail/mail.service';
import { aiSuggestions } from '../../../src/modules/review/review.table';
import { testApp } from '../../support/app';
import { clientThread, ctx, DANA, injection, invoicePaid, newsletter, OMAR } from '../../support/fixtures';
import { fakeOpenRouter } from '../../support/recorded';

async function pipeline(or = fakeOpenRouter()) {
  const app = await testApp({ fetch: or.fetch });
  return { ...app, or, mail: app.get(MailService) };
}

describe('an email through the pipeline', () => {
  it('turns a client request into verified task suggestions with owners and real dates', async () => {
    const { mail } = await pipeline();
    const trace = await mail.processEmail(ctx(), clientThread);
    expect(trace.triage).toMatchObject({ kind: 'request', priority: 'high', needsReply: true });
    expect(trace.schedulingAsk).toBe(true);
    expect(trace.suggestions).toEqual([
      { title: 'Send revised homepage wireframes to Megan', owner: DANA.email, due: '2026-09-25', flags: [] },
      { title: 'Remove the blog migration from the phase 2 SOW', owner: DANA.email, due: null, flags: [] },
      { title: 'Confirm analytics tagging on the checkout pages', owner: OMAR.email, due: '2026-09-25', flags: [] },
    ]);
  });

  it('drops a commitment the model took from the quoted history instead of this message', async () => {
    const { mail } = await pipeline();
    const trace = await mail.processEmail(ctx(), clientThread);
    expect(trace.extraction!.dropped).toEqual([{ title: 'Send Q4 pricing to Megan', reason: 'quote_not_in_source' }]);
  });

  it('creates nothing: every suggestion waits in the review queue', async () => {
    const { mail, db } = await pipeline();
    await mail.processEmail(ctx(), clientThread);
    const rows = await db.select().from(aiSuggestions);
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.status === 'pending' && r.createdTaskId === null)).toBe(true);
  });

  it('treats a redelivered Graph notification as a no-op, with no second model call', async () => {
    const { mail, db, or } = await pipeline();
    await mail.processEmail(ctx(), clientThread);
    const again = await mail.processEmail(ctx(), clientThread);
    expect(again.outcome).toBe('duplicate');
    expect(or.calls.length).toBe(2); // triage + extract, from the first delivery only
    expect((await db.select().from(aiSuggestions)).length).toBe(3);
  });

  it('never calls a model for a newsletter, and stops after triage for an FYI', async () => {
    const { mail, or } = await pipeline();
    const n = await mail.processEmail(ctx(), newsletter);
    const f = await mail.processEmail(ctx(), invoicePaid);
    expect(n).toMatchObject({ outcome: 'skipped', skippedReason: 'mailing_list' });
    expect(f.outcome).toBe('triaged');
    expect(or.calls.map((c) => c.key)).toEqual(['triage:Invoice 2041 paid']);
  });

  it('writes one ledger row per call with the model that served it', async () => {
    const { mail, db } = await pipeline();
    await mail.processEmail(ctx(), clientThread);
    const calls = await db.select().from(aiCalls).where(eq(aiCalls.tenantId, ctx().tenantId));
    expect(calls.map((c) => [c.stage, c.modelUsed])).toEqual([['triage', 'openai/gpt-5-mini'], ['extract', 'anthropic/claude-sonnet-5']]);
  });
});

describe('prompt injection in an email', () => {
  it('cannot assign work outside the thread, and the item still waits for a person', async () => {
    const { mail, db } = await pipeline();
    const trace = await mail.processEmail(ctx(), injection);
    // the model did what the email said; the verifier took the owner away
    expect(trace.suggestions).toEqual([{ title: 'Export the full client list', owner: null, due: '2026-09-23', flags: ['owner_outside_thread'] }]);
    const [row] = await db.select().from(aiSuggestions);
    expect(row!.status).toBe('pending');
  });
});
