import { Inject, Injectable } from '@nestjs/common';
import type { TenantCtx } from '../../core/tenancy';
import type { GraphMessage } from '../../integrations/microsoft-graph/graph.types';
import { AiService } from '../ai/ai.service';
import { ExtractionService, verifyCommitments } from '../extraction/extraction.service';
import { ReviewService } from '../review/review.service';
import { MailRepository } from './mail.repository';
import { prefilter } from './prefilter';
import { prepare } from './prepare';
import { Triage, TRIAGE_PROMPT } from './triage.contract';

export interface Trace {
  messageId: string;
  outcome: 'duplicate' | 'skipped' | 'triaged' | 'suggested';
  skippedReason?: string;
  triage?: { kind: string; priority: string; needsReply: boolean; model: string };
  extraction?: { model: string; kept: number; dropped: { title: string; reason: string }[] };
  suggestions: { title: string; owner: string | null; due: string | null; flags: string[] }[];
  schedulingAsk: boolean;
}

@Injectable()
export class MailService {
  constructor(
    @Inject(MailRepository) private readonly repo: MailRepository,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(ExtractionService) private readonly extraction: ExtractionService,
    @Inject(ReviewService) private readonly review: ReviewService,
  ) {}

  /**
   * Runs for every Microsoft Graph change notification on a mailbox, as a queue job.
   * Graph delivers at least once, so the first thing it does is make sure this message
   * has not been processed already. Nothing it produces is visible as a task until a
   * person accepts it from the review queue.
   */
  async processEmail(ctx: TenantCtx, msg: GraphMessage): Promise<Trace> {
    const trace: Trace = { messageId: msg.id, outcome: 'duplicate', suggestions: [], schedulingAsk: false };
    const item = await this.repo.claim(ctx.tenantId, msg.id, msg.conversationId);
    if (!item) return trace;

    const skip = prefilter(msg);
    if (skip) {
      await this.repo.markSkipped(item.id, skip);
      return { ...trace, outcome: 'skipped', skippedReason: skip };
    }

    const { text, participants } = prepare(msg);
    const t = await this.ai.complete(ctx, 'triage', Triage, TRIAGE_PROMPT, `Subject: ${msg.subject}\n\n${text}`);
    await this.repo.saveTriage(ctx.tenantId, item.id, t.data);
    trace.outcome = 'triaged';
    trace.triage = { kind: t.data.kind, priority: t.data.priority, needsReply: t.data.needs_reply, model: t.model };
    trace.schedulingAsk = t.data.has_scheduling_ask;
    // only requests and decisions can contain work; everything else stops at triage
    if (!['request', 'decision'].includes(t.data.kind)) return trace;

    const e = await this.extraction.extract(ctx, msg.subject, text);
    const { kept, dropped } = verifyCommitments(e.data, text, participants, ctx, new Date(msg.sentDateTime), msg.conversationId);
    trace.extraction = { model: e.model, kept: kept.length, dropped };
    const inserted = await this.review.propose(kept.map((s) => ({
      tenantId: ctx.tenantId, itemId: item.id, type: 'task' as const, dedupKey: s.dedupKey, evidence: s.quote, flags: s.flags,
      payload: { title: s.title, ownerId: s.ownerId, ownerEmail: s.ownerEmail, due: s.due, dueText: s.dueText, quote: s.quote, priority: t.data.priority },
    })));
    const isNew = new Set(inserted.map((r) => r.dedupKey));
    for (const s of kept) if (isNew.has(s.dedupKey)) trace.suggestions.push({ title: s.title, owner: s.ownerEmail, due: s.due, flags: s.flags });
    trace.outcome = trace.suggestions.length ? 'suggested' : 'triaged';
    return trace;
  }
}
