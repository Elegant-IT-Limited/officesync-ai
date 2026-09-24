import { and, eq } from 'drizzle-orm';
import type { DB } from './db';
import { aiSuggestions } from './schema';
import type { Ctx } from './types';

export interface TaskWriter {
  create(input: { tenantId: string; title: string; assigneeId: string | null; dueDate: string | null; sourceQuote: string }): Promise<{ id: string }>;
}

export class NotFound extends Error {}
export class AlreadyDecided extends Error {}

/**
 * The only path from a suggestion to a real task, and it starts with a person's click.
 * Scoped by tenant in the query itself, idempotent on double-submit, and a dismissed
 * suggestion can never be revived by a stale tab.
 */
export async function acceptSuggestion(
  db: DB, ctx: Ctx, id: string, userId: string, tasks: TaskWriter,
  edits: { title?: string; assigneeId?: string | null; dueDate?: string | null } = {},
): Promise<{ taskId: string }> {
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(aiSuggestions)
      .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.tenantId, ctx.tenantId))).for('update');
    if (!s) throw new NotFound(id);
    if (s.status === 'accepted' && s.createdTaskId) return { taskId: s.createdTaskId };
    if (s.status !== 'pending') throw new AlreadyDecided(id);
    const p = s.payload as { title: string; ownerId: string | null; due: string | null; quote: string };
    const task = await tasks.create({
      tenantId: ctx.tenantId,
      title: edits.title ?? p.title,
      assigneeId: edits.assigneeId !== undefined ? edits.assigneeId : p.ownerId,
      dueDate: edits.dueDate !== undefined ? edits.dueDate : p.due,
      sourceQuote: p.quote,
    });
    await tx.update(aiSuggestions)
      .set({ status: 'accepted', decidedBy: userId, decidedAt: new Date(), createdTaskId: task.id })
      .where(eq(aiSuggestions.id, id));
    return { taskId: task.id };
  });
}

export async function dismissSuggestion(db: DB, ctx: Ctx, id: string, userId: string): Promise<void> {
  const rows = await db.update(aiSuggestions)
    .set({ status: 'dismissed', decidedBy: userId, decidedAt: new Date() })
    .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.tenantId, ctx.tenantId), eq(aiSuggestions.status, 'pending')))
    .returning({ id: aiSuggestions.id });
  if (!rows.length) throw new NotFound(id);
}
