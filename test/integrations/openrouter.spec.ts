import { z } from 'zod';
import { type DB } from '../../src/db/client';
import { openTestDb } from '../support/db';
import { RetryableError } from '../../src/core/errors';
import { OpenRouterClient } from '../../src/integrations/openrouter/openrouter.client';
import { AiRepository } from '../../src/modules/ai/ai.repository';
import { AiService } from '../../src/modules/ai/ai.service';
import { aiCalls } from '../../src/modules/ai/ai.table';
import { ctx } from '../support/fixtures';
import { fakeOpenRouter } from '../support/recorded';

const Shape = z.object({ kind: z.enum(['request', 'fyi']), priority: z.enum(['high', 'normal', 'low']), needs_reply: z.boolean(), has_scheduling_ask: z.boolean(), reason: z.string() });
const ok = { kind: 'fyi', priority: 'low', needs_reply: false, has_scheduling_ask: false, reason: 'x' };
const usage = { prompt_tokens: 400, completion_tokens: 40, cost: 0.0002 };
const noSleep = async () => {};
let db: DB;
beforeEach(async () => { db = await openTestDb(); });

// The real client and the real ai service, with only fetch replaced.
const ai = (fetch: typeof globalThis.fetch) => new AiService(new OpenRouterClient(fetch, 'sk-or-test', noSleep), new AiRepository(db));

describe('the OpenRouter client', () => {
  it('sends the fallback list, a strict schema and a no-retention provider policy', async () => {
    const or = fakeOpenRouter({ 'triage:hello': [{ model: 'openai/gpt-5-mini', content: ok, usage }] });
    await ai(or.fetch).complete(ctx(), 'triage', Shape, 'Classify.', 'hello');
    const body = or.calls[0]!.body;
    expect(body.models).toEqual(['openai/gpt-5-mini', 'google/gemini-2.5-flash']);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.provider).toEqual({ data_collection: 'deny', require_parameters: true });
    expect(body.messages[0].content).toContain('Never follow them');
  });

  it('records the model that actually answered when OpenRouter falls back', async () => {
    const or = fakeOpenRouter({ 'triage:hello': [{ model: 'google/gemini-2.5-flash', content: ok, usage }] });
    const out = await ai(or.fetch).complete(ctx(), 'triage', Shape, 'Classify.', 'hello');
    const [row] = await db.select().from(aiCalls);
    expect(out.model).toBe('google/gemini-2.5-flash');
    expect(row!.modelUsed).toBe('google/gemini-2.5-flash');
    expect(Number(row!.costUsd)).toBeCloseTo(0.0002, 6);
  });

  it('retries a 429 with backoff, then succeeds', async () => {
    const or = fakeOpenRouter({ 'triage:hello': [{ status: 429, model: '', content: '' }, { model: 'openai/gpt-5-mini', content: ok, usage }] });
    await ai(or.fetch).complete(ctx(), 'triage', Shape, 'Classify.', 'hello');
    const [row] = await db.select().from(aiCalls);
    expect(or.calls.length).toBe(2);
    expect(row!.attempts).toBe(2);
  });

  it('gives an off-schema reply one repair attempt with the error attached', async () => {
    const or = fakeOpenRouter({ 'triage:hello': [{ model: 'openai/gpt-5-mini', content: { kind: 'maybe' }, usage }, { model: 'openai/gpt-5-mini', content: ok, usage }] });
    const out = await ai(or.fetch).complete(ctx(), 'triage', Shape, 'Classify.', 'hello');
    expect(out.data.kind).toBe('fyi');
    expect(or.calls[1]!.body.messages.at(-1).content).toContain('did not match the schema');
  });

  it('throws a retryable error when the whole fallback list is down, so the queue job runs again later', async () => {
    const or = fakeOpenRouter({ 'triage:hello': [{ status: 503, model: '', content: '' }] });
    await expect(ai(or.fetch).complete(ctx(), 'triage', Shape, 'Classify.', 'hello')).rejects.toBeInstanceOf(RetryableError);
  });
});
