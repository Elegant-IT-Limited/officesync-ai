import { bigserial, boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.tenantId, t.source, t.sourceId)]);

export const aiSuggestions = pgTable('ai_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  itemId: uuid('item_id').references(() => aiItems.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['task', 'summary', 'reminder', 'slots'] }).notNull(),
  payload: jsonb('payload').notNull(),
  evidence: text('evidence'),
  flags: text('flags').array().notNull().default([]),
  dedupKey: text('dedup_key').notNull(),
  status: text('status', { enum: ['pending', 'accepted', 'dismissed'] }).notNull().default('pending'),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdTaskId: uuid('created_task_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.tenantId, t.dedupKey), index('ai_suggestions_queue').on(t.tenantId, t.status, t.createdAt)]);

export const aiCalls = pgTable('ai_calls', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  stage: text('stage').notNull(),
  modelUsed: text('model_used').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
  attempts: integer('attempts').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
