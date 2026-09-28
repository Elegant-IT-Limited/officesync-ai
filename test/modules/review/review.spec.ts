import { AlreadyDecided, NotFound } from '../../../src/core/errors';
import type { TaskWriter } from '../../../src/integrations/officesyncpro/tasks.client';
import { MailService } from '../../../src/modules/mail/mail.service';
import { ReviewService } from '../../../src/modules/review/review.service';
import { aiSuggestions } from '../../../src/modules/review/review.table';
import { testApp } from '../../support/app';
import { clientThread, ctx, DANA, OTHER_TENANT } from '../../support/fixtures';
import { fakeOpenRouter } from '../../support/recorded';

let created: any[];
const tasks: TaskWriter = { async create(input) { created.push(input); return { id: `9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c${String(created.length).padStart(2, '0')}` }; } };

// Each test starts with the three suggestions the client email produces.
async function queue() {
  created = [];
  const app = await testApp({ fetch: fakeOpenRouter().fetch, tasks });
  await app.get(MailService).processEmail(ctx(), clientThread);
  const rows = await app.db.select().from(aiSuggestions).orderBy(aiSuggestions.createdAt);
  return { review: app.get(ReviewService), rows, tenantId: ctx().tenantId };
}

describe('the review queue', () => {
  it('creates the task only on accept, carrying the owner, date and the source sentence', async () => {
    const { review, rows, tenantId } = await queue();
    await review.accept(tenantId, rows[0]!.id, DANA.id);
    expect(created).toEqual([{ tenantId, title: 'Send revised homepage wireframes to Megan', assigneeId: DANA.id, dueDate: '2026-09-25', sourceQuote: 'Could you send the revised homepage wireframes by Friday?' }]);
  });

  it('applies the edits a person makes before accepting', async () => {
    const { review, rows, tenantId } = await queue();
    await review.accept(tenantId, rows[0]!.id, DANA.id, { dueDate: '2026-09-24', title: 'Send homepage wireframes v2 to Megan' });
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
  });

  it('another workspace cannot see or accept it', async () => {
    const { review, rows } = await queue();
    await expect(review.accept(OTHER_TENANT, rows[0]!.id, DANA.id)).rejects.toBeInstanceOf(NotFound);
    expect(created.length).toBe(0);
  });
});
