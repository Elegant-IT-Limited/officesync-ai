import { boolean, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

// Mirrors migrations/mail/0001_ai_items.sql. The migration is the source of truth.
export const aiItems = pgTable('ai_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  source: text('source', { enum: ['email', 'meeting'] }).notNull(),
  sourceId: text('source_id').notNull(),
  conversationId: text('conversation_id'),
  kind: text('kind'),
  priority: text('priority'),
  needsReply: boolean('needs_reply'),
  skippedReason: text('skipped_reason'),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [unique().on(t.tenantId, t.source, t.sourceId)]);
