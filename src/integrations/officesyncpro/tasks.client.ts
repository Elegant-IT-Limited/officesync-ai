/** What review needs from the product's task system: create one task. */
export interface TaskWriter {
  create(input: { tenantId: string; title: string; assigneeId: string | null; dueDate: string | null; sourceQuote: string }): Promise<{ id: string }>;
}
export const TASK_WRITER = Symbol('TASK_WRITER');

/** The OfficeSyncPro internal tasks API. The task keeps the source sentence so a person can see why it exists. */
export class HttpTaskWriter implements TaskWriter {
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetch: typeof globalThis.fetch = globalThis.fetch) {}

  async create(input: Parameters<TaskWriter['create']>[0]): Promise<{ id: string }> {
    const res = await this.fetch(`${this.baseUrl}/internal/tenants/${input.tenantId}/tasks`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: input.title, assigneeId: input.assigneeId, dueDate: input.dueDate, source: { kind: 'ai_suggestion', quote: input.sourceQuote } }),
    });
    if (!res.ok) throw new Error(`officesyncpro tasks: HTTP ${res.status}`);
    return (await res.json()) as { id: string };
  }
}
