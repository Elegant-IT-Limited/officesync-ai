import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { RetryableError } from '../../core/errors';
import { DATABASE, type DB } from '../../db/client';
import type { Triage } from './triage.contract';
import { aiItems } from './mail.table';

@Injectable()
export class MailRepository {
  constructor(@Inject(DATABASE) private readonly db: DB) {}

  /**
   * Claims a Graph message for this tenant, as a lease. Graph delivers change
   * notifications at least once, so:
   * - a message already completed returns undefined, and the job stops before any
   *   model is called;
   * - a message another job is working on right now throws RetryableError, so the
   *   queue tries again later instead of paying for every model call twice;
   * - a message whose attempt failed (released) or whose job died (lease expired)
   *   is claimed again, so the email is finished rather than dropped.
   * Suggestions are keyed on the source sentence, so a re-run cannot queue twice.
   */
  async claim(tenantId: string, messageId: string, conversationId: string): Promise<{ id: string } | undefined> {
    const [fresh] = await this.db.insert(aiItems)
      .values({ tenantId, source: 'email', sourceId: messageId, conversationId })
      .onConflictDoNothing().returning({ id: aiItems.id });
    if (fresh) return fresh;
    const item = and(eq(aiItems.tenantId, tenantId), eq(aiItems.source, 'email'), eq(aiItems.sourceId, messageId));
    // one UPDATE, so two retries racing for a lapsed lease cannot both win it
    const [reclaimed] = await this.db.update(aiItems).set({ claimedAt: new Date() })
      .where(and(item, isNull(aiItems.completedAt), lt(aiItems.claimedAt, sql`now() - interval '10 minutes'`)))
      .returning({ id: aiItems.id });
    if (reclaimed) return reclaimed;
    const [existing] = await this.db.select({ completedAt: aiItems.completedAt }).from(aiItems).where(item);
    if (existing && !existing.completedAt) throw new RetryableError(`message ${messageId} is being processed by another job`);
    return undefined;
  }

  /** Gives the lease back after a failed attempt, so the queue's retry can claim it at once. */
  async release(tenantId: string, itemId: string): Promise<void> {
    await this.db.update(aiItems).set({ claimedAt: new Date(0) }).where(and(eq(aiItems.id, itemId), eq(aiItems.tenantId, tenantId)));
  }

  async markSkipped(tenantId: string, itemId: string, reason: string): Promise<void> {
    await this.db.update(aiItems).set({ skippedReason: reason }).where(and(eq(aiItems.id, itemId), eq(aiItems.tenantId, tenantId)));
  }

  async saveTriage(tenantId: string, itemId: string, t: Triage): Promise<void> {
    await this.db.update(aiItems).set({ kind: t.kind, priority: t.priority, needsReply: t.needs_reply })
      .where(and(eq(aiItems.id, itemId), eq(aiItems.tenantId, tenantId)));
  }

  /** The last write of a successful run. Until it happens, a redelivery or a retry re-enters. */
  async complete(tenantId: string, itemId: string): Promise<void> {
    await this.db.update(aiItems).set({ completedAt: new Date() }).where(and(eq(aiItems.id, itemId), eq(aiItems.tenantId, tenantId)));
  }
}
