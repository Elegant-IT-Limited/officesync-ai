import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type DB } from '../../db/client';
import type { Triage } from './triage.contract';
import { aiItems } from './mail.table';

@Injectable()
export class MailRepository {
  constructor(@Inject(DATABASE) private readonly db: DB) {}

  /**
   * Claims a Graph message for this tenant. Returns undefined when it was already
   * claimed: Graph delivers change notifications at least once, and a redelivery
   * must stop here, before any model is called.
   */
  async claim(tenantId: string, messageId: string, conversationId: string): Promise<{ id: string } | undefined> {
    const [item] = await this.db.insert(aiItems)
      .values({ tenantId, source: 'email', sourceId: messageId, conversationId })
      .onConflictDoNothing().returning({ id: aiItems.id });
    return item;
  }

  async markSkipped(itemId: string, reason: string): Promise<void> {
    await this.db.update(aiItems).set({ skippedReason: reason }).where(eq(aiItems.id, itemId));
  }

  async saveTriage(tenantId: string, itemId: string, t: Triage): Promise<void> {
    await this.db.update(aiItems).set({ kind: t.kind, priority: t.priority, needsReply: t.needs_reply })
      .where(and(eq(aiItems.id, itemId), eq(aiItems.tenantId, tenantId)));
  }
}
