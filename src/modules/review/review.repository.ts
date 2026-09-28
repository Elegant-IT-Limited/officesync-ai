import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE, type DB } from '../../db/client';
import { aiSuggestions } from './review.table';

export type NewSuggestion = typeof aiSuggestions.$inferInsert;
export type Suggestion = typeof aiSuggestions.$inferSelect;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

@Injectable()
export class ReviewRepository {
  constructor(@Inject(DATABASE) private readonly db: DB) {}

  /** Inserts what is new and silently skips what was already suggested (same tenant, same dedup key). */
  async insertNew(rows: NewSuggestion[]): Promise<{ id: string; dedupKey: string }[]> {
    if (!rows.length) return [];
    return this.db.insert(aiSuggestions).values(rows).onConflictDoNothing()
      .returning({ id: aiSuggestions.id, dedupKey: aiSuggestions.dedupKey });
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  /** Locks the row for the rest of the transaction, so two clicks cannot both create a task. */
  async lockForDecision(tx: Tx, tenantId: string, id: string): Promise<Suggestion | undefined> {
    // tenant in the WHERE clause, not checked afterwards: another workspace's id finds nothing
    const [s] = await tx.select().from(aiSuggestions)
      .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.tenantId, tenantId))).for('update');
    return s;
  }

  async markAccepted(tx: Tx, id: string, userId: string, taskId: string): Promise<void> {
    await tx.update(aiSuggestions)
      .set({ status: 'accepted', decidedBy: userId, decidedAt: new Date(), createdTaskId: taskId })
      .where(eq(aiSuggestions.id, id));
  }

  async markDismissed(tx: Tx, id: string, userId: string): Promise<void> {
    await tx.update(aiSuggestions)
      .set({ status: 'dismissed', decidedBy: userId, decidedAt: new Date() })
      .where(eq(aiSuggestions.id, id));
  }

  /** Newest first, the order the queue index is built for. */
  async pending(tenantId: string, limit: number): Promise<Suggestion[]> {
    return this.db.select().from(aiSuggestions)
      .where(and(eq(aiSuggestions.tenantId, tenantId), eq(aiSuggestions.status, 'pending')))
      .orderBy(desc(aiSuggestions.createdAt)).limit(limit);
  }
}
