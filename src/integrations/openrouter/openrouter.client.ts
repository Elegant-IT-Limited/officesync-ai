import { z } from 'zod';
import { RetryableError } from '../../core/errors';

export interface ChatRequest {
  name: string;          // schema name, sent to the provider and used in the ledger
  models: string[];      // priority order; OpenRouter falls through the list
  maxTokens: number;
  system: string;
  source: string;        // untrusted content, wrapped in <source> tags
  schema: z.ZodType;
}

export interface ChatResult {
  data: unknown;         // already validated against request.schema
  model: string;         // the model that actually answered, not always models[0]
  attempts: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export const OPENROUTER_FETCH = Symbol('OPENROUTER_FETCH');
export const OPENROUTER_API_KEY = Symbol('OPENROUTER_API_KEY');
export const OPENROUTER_SLEEP = Symbol('OPENROUTER_SLEEP');

// Timeouts, rate limits and gateway errors are worth another try. Any other status
// means the request itself is wrong, and repeating it would only repeat the error.
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * One structured call through OpenRouter. Knows HTTP, retries and the schema
 * contract; knows nothing about tenants, stages or the ledger. The ai module wraps it.
 */
export class OpenRouterClient {
  constructor(
    private readonly fetch: typeof globalThis.fetch,
    private readonly apiKey: string,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async complete(req: ChatRequest): Promise<ChatResult> {
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: req.system },
      { role: 'user', content: `<source>\n${req.source}\n</source>` },
    ];
    const total = { attempts: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 };

    // A reply that fails the schema gets exactly one repair attempt with the
    // validation error attached. A second failure is a prompt problem, not bad luck.
    for (let repair = 0; repair < 2; repair++) {
      let res: Response | undefined;
      for (let i = 0; i < 3; i++) {
        total.attempts++;
        res = await this.fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json', 'x-title': 'OfficeSyncPro' },
          body: JSON.stringify({
            models: req.models,
            messages,
            max_tokens: req.maxTokens,
            temperature: 0,
            response_format: { type: 'json_schema', json_schema: { name: req.name, strict: true, schema: z.toJSONSchema(req.schema) } },
            // deny: only providers that neither store nor train on prompts.
            // require_parameters: skip any provider that cannot honour the strict schema.
            provider: { data_collection: 'deny', require_parameters: true },
            usage: { include: true },
          }),
        });
        if (!RETRY_STATUS.has(res.status)) break;
        if (i < 2) await this.sleep(250 * 2 ** i); // 250 then 500 ms; no wait after the last try
      }
      // the queue retries the whole job later; retrying harder here would only
      // hold a worker while every provider on the list is down
      if (!res || !res.ok) throw new RetryableError(`openrouter ${req.name}: HTTP ${res?.status}`);

      const body = (await res.json()) as {
        model: string; choices: { message: { content: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      };
      total.promptTokens += body.usage?.prompt_tokens ?? 0;
      total.completionTokens += body.usage?.completion_tokens ?? 0;
      total.costUsd += body.usage?.cost ?? 0;
      const content = body.choices[0]?.message.content ?? '';

      let json: unknown;
      try { json = JSON.parse(content); } catch { json = undefined; }
      const parsed = req.schema.safeParse(json);
      if (parsed.success) return { data: parsed.data, model: body.model, ...total };

      messages.push(
        { role: 'assistant', content },
        { role: 'user', content: `That reply did not match the schema: ${json === undefined ? 'not valid JSON' : parsed.error?.message}. Reply again with valid JSON only.` },
      );
    }
    throw new RetryableError(`openrouter ${req.name}: schema not met after repair`);
  }
}
