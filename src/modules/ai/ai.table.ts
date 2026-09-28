import { bigserial, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Mirrors migrations/ai/0003_ai_calls.sql. The migration is the source of truth.
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
