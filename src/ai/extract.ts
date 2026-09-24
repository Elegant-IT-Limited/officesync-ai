import { createHash } from 'node:crypto';
import { z } from 'zod';
import { resolveDue } from './due-date';
import { complete, type ModelDeps } from './openrouter';
import { normalise } from './prepare';
import type { Ctx } from './types';

export const Extraction = z.object({
  commitments: z.array(z.object({
    title: z.string().min(3).max(90),
    owner_email: z.string().nullable(),
    due_text: z.string().nullable(),
    quote: z.string().min(8),
  })).max(6),
});

const SYSTEM = `List the concrete commitments in this email: things a named person is asked to do or agrees to do.
title: an imperative task title under 90 characters.
owner_email: the address of the person who should do it, only if the email makes that clear, else null.
due_text: the deadline exactly as written ("by Friday", "end of week"), else null. Do not convert it to a date.
quote: the exact sentence from the email that states the commitment, copied verbatim.
Ignore pleasantries, history and anything already done.`;

export interface TaskSuggestion {
  title: string;
  ownerId: string | null;
  ownerEmail: string | null;
  due: string | null;
  dueText: string | null;
  quote: string;
  flags: string[];
  dedupKey: string;
}

/**
 * The model proposes, this function decides what survives. A commitment is kept only
 * if its quote really appears in the email. An owner is kept only if they are on the
 * thread or in the workspace: text inside an email must never be able to assign work
 * to an arbitrary address. Dates are resolved here, not by the model.
 */
export function verifyCommitments(
  raw: z.infer<typeof Extraction>, text: string, participants: string[], ctx: Ctx,
  sentAt: Date, conversationId: string,
): { kept: TaskSuggestion[]; dropped: { title: string; reason: string }[] } {
  const haystack = normalise(text);
  const kept: TaskSuggestion[] = [];
  const dropped: { title: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const c of raw.commitments) {
    if (!haystack.includes(normalise(c.quote))) { dropped.push({ title: c.title, reason: 'quote_not_in_source' }); continue; }
    const flags: string[] = [];
    let ownerEmail = c.owner_email?.toLowerCase() ?? null;
    const member = ctx.members.find((m) => m.email.toLowerCase() === ownerEmail);
    if (ownerEmail && !member && !participants.includes(ownerEmail)) { flags.push('owner_outside_thread'); ownerEmail = null; }
    const due = resolveDue(c.due_text, sentAt, ctx.timeZone);
    if (c.due_text && !due) flags.push('due_unresolved');
    const dedupKey = createHash('sha256').update(`${ctx.tenantId}|${conversationId}|${normalise(c.quote)}`).digest('hex');
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    kept.push({ title: c.title, ownerId: member?.id ?? null, ownerEmail, due, dueText: c.due_text, quote: c.quote, flags, dedupKey });
  }
  return { kept, dropped };
}

export const extract = (deps: ModelDeps, ctx: Ctx, subject: string, text: string) =>
  complete(deps, ctx, 'extract', Extraction, SYSTEM, `Subject: ${subject}\n\n${text}`);
