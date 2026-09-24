import { openDb, type DB } from '../src/ai/db';
import { processEmail } from '../src/ai/pipeline';
import { acceptSuggestion, AlreadyDecided, dismissSuggestion, NotFound, type TaskWriter } from '../src/ai/review';
import { aiSuggestions } from '../src/ai/schema';
import { clientThread, ctx, DANA, OTHER_TENANT } from './fixtures';
import { fakeOpenRouter } from './recorded';

let db: DB;
let created: any[];
const tasks: TaskWriter = { async create(input) { created.push(input); return { id: `9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c${String(created.length).padStart(2, '0')}` }; } };
beforeEach(async () => {
  db = await openDb();
  created = [];
  await processEmail({ db, fetch: fakeOpenRouter().fetch, apiKey: 'k' }, ctx(), clientThread);
});
const first = async () => (await db.select().from(aiSuggestions).orderBy(aiSuggestions.createdAt))[0]!;

describe('the review queue', () => {
  it('creates the task only on accept, carrying the owner, date and the source sentence', async () => {
    const s = await first();
    await acceptSuggestion(db, ctx(), s.id, DANA.id, tasks);
    expect(created).toEqual([{ tenantId: ctx().tenantId, title: 'Send revised homepage wireframes to Megan', assigneeId: DANA.id, dueDate: '2026-09-25', sourceQuote: 'Could you send the revised homepage wireframes by Friday?' }]);
  });

  it('applies the edits a person makes before accepting', async () => {
    const s = await first();
    await acceptSuggestion(db, ctx(), s.id, DANA.id, tasks, { dueDate: '2026-09-24', title: 'Send homepage wireframes v2 to Megan' });
    expect(created[0]).toMatchObject({ title: 'Send homepage wireframes v2 to Megan', dueDate: '2026-09-24' });
  });

  it('is idempotent on a double click, and a dismissed suggestion cannot come back', async () => {
    const [a, b] = await db.select().from(aiSuggestions);
    const one = await acceptSuggestion(db, ctx(), a!.id, DANA.id, tasks);
    const two = await acceptSuggestion(db, ctx(), a!.id, DANA.id, tasks);
    expect(two).toEqual(one);
    expect(created.length).toBe(1);
    await dismissSuggestion(db, ctx(), b!.id, DANA.id);
    await expect(acceptSuggestion(db, ctx(), b!.id, DANA.id, tasks)).rejects.toBeInstanceOf(AlreadyDecided);
  });

  it('another workspace cannot see or accept it', async () => {
    const s = await first();
    await expect(acceptSuggestion(db, ctx({ tenantId: OTHER_TENANT }), s.id, DANA.id, tasks)).rejects.toBeInstanceOf(NotFound);
    expect(created.length).toBe(0);
  });
});
