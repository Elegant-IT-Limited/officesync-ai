import { and, eq } from 'drizzle-orm';
import { extract, verifyCommitments } from './extract';
import type { ModelDeps } from './openrouter';
import { prefilter } from './prefilter';
import { prepare } from './prepare';
import { aiItems, aiSuggestions } from './schema';
import { triage } from './triage';
import type { Ctx, GraphMessage } from './types';

export interface Trace {
  messageId: string;
  outcome: 'duplicate' | 'skipped' | 'triaged' | 'suggested';
  skippedReason?: string;
  triage?: { kind: string; priority: string; needsReply: boolean; model: string };
  extraction?: { model: string; kept: number; dropped: { title: string; reason: string }[] };
  suggestions: { title: string; owner: string | null; due: string | null; flags: string[] }[];
  schedulingAsk: boolean;
}

/**
 * Runs for every Microsoft Graph change notification on a mailbox, as a queue job.
 * Graph delivers at least once, so the first thing it does is make sure this message
 * has not been processed already. Nothing it produces is visible as a task until a
 * person accepts it from the review queue.
 */
export async function processEmail(deps: ModelDeps, ctx: Ctx, msg: GraphMessage): Promise<Trace> {
  const trace: Trace = { messageId: msg.id, outcome: 'duplicate', suggestions: [], schedulingAsk: false };
  const [item] = await deps.db.insert(aiItems)
    .values({ tenantId: ctx.tenantId, source: 'email', sourceId: msg.id, conversationId: msg.conversationId })
    .onConflictDoNothing().returning({ id: aiItems.id });
  if (!item) return trace;

  const skip = prefilter(msg);
  if (skip) {
    await deps.db.update(aiItems).set({ skippedReason: skip }).where(eq(aiItems.id, item.id));
    return { ...trace, outcome: 'skipped', skippedReason: skip };
  }

  const { text, participants } = prepare(msg);
  const t = await triage(deps, ctx, msg.subject, text);
  await deps.db.update(aiItems).set({ kind: t.data.kind, priority: t.data.priority, needsReply: t.data.needs_reply })
    .where(and(eq(aiItems.id, item.id), eq(aiItems.tenantId, ctx.tenantId)));
  trace.outcome = 'triaged';
  trace.triage = { kind: t.data.kind, priority: t.data.priority, needsReply: t.data.needs_reply, model: t.model };
  trace.schedulingAsk = t.data.has_scheduling_ask;
  if (!['request', 'decision'].includes(t.data.kind)) return trace;

  const e = await extract(deps, ctx, msg.subject, text);
  const { kept, dropped } = verifyCommitments(e.data, text, participants, ctx, new Date(msg.sentDateTime), msg.conversationId);
  trace.extraction = { model: e.model, kept: kept.length, dropped };
  for (const s of kept) {
    const [row] = await deps.db.insert(aiSuggestions).values({
      tenantId: ctx.tenantId, itemId: item.id, type: 'task', dedupKey: s.dedupKey, evidence: s.quote, flags: s.flags,
      payload: { title: s.title, ownerId: s.ownerId, ownerEmail: s.ownerEmail, due: s.due, dueText: s.dueText, quote: s.quote, priority: t.data.priority },
    }).onConflictDoNothing().returning({ id: aiSuggestions.id });
    if (row) trace.suggestions.push({ title: s.title, owner: s.ownerEmail, due: s.due, flags: s.flags });
  }
  trace.outcome = trace.suggestions.length ? 'suggested' : 'triaged';
  return trace;
}
