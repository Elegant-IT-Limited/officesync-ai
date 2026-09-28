import { index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { aiItems } from '../mail/mail.table';

// Mirrors migrations/review/0002_ai_suggestions.sql. The migration is the source of truth.
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
