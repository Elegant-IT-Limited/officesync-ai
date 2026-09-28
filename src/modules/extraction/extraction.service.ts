import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { resolveDue } from '../../core/dates';
import type { TenantCtx } from '../../core/tenancy';
import { normalise } from '../../core/text';
import { AiService } from '../ai/ai.service';
import { Extraction, EXTRACTION_PROMPT } from './extraction.contract';

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
  raw: Extraction, text: string, participants: string[], ctx: TenantCtx,
  sentAt: Date, conversationId: string,
): { kept: TaskSuggestion[]; dropped: { title: string; reason: string }[] } {
  const haystack = normalise(text);
  const kept: TaskSuggestion[] = [];
  const dropped: { title: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const c of raw.commitments) {
    // the check that catches quoted history: text copied from an older message is
    // not in `text`, because prepare() already cut it
    if (!haystack.includes(normalise(c.quote))) { dropped.push({ title: c.title, reason: 'quote_not_in_source' }); continue; }
    const flags: string[] = [];
    let ownerEmail = c.owner_email?.toLowerCase() ?? null;
    const member = ctx.members.find((m) => m.email.toLowerCase() === ownerEmail);
    if (ownerEmail && !member && !participants.includes(ownerEmail)) { flags.push('owner_outside_thread'); ownerEmail = null; }
    const due = resolveDue(c.due_text, sentAt, ctx.timeZone);
    if (c.due_text && !due) flags.push('due_unresolved');
    // keyed on the sentence, so the same request in a later reply is not suggested twice
    const dedupKey = createHash('sha256').update(`${ctx.tenantId}|${conversationId}|${normalise(c.quote)}`).digest('hex');
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    kept.push({ title: c.title, ownerId: member?.id ?? null, ownerEmail, due, dueText: c.due_text, quote: c.quote, flags, dedupKey });
  }
  return { kept, dropped };
}

@Injectable()
export class ExtractionService {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  extract(ctx: TenantCtx, subject: string, text: string) {
    return this.ai.complete(ctx, 'extract', Extraction, EXTRACTION_PROMPT, `Subject: ${subject}\n\n${text}`);
  }
}
