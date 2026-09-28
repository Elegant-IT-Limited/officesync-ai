import { Inject, Injectable } from '@nestjs/common';
import { AlreadyDecided, NotAcceptableHere, NotFound } from '../../core/errors';
import { TASK_WRITER, type TaskWriter } from '../../integrations/officesyncpro/tasks.client';
import { ReviewRepository, type NewSuggestion, type Suggestion } from './review.repository';

export interface AcceptEdits { title?: string; assigneeId?: string | null; dueDate?: string | null }

/**
 * The review queue. Every lane (mail, meetings, follow-ups, scheduling) proposes into
 * it, and accept() is the only path from a suggestion to a real task. It starts
 * with a person's click.
 */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(ReviewRepository) private readonly repo: ReviewRepository,
    @Inject(TASK_WRITER) private readonly tasks: TaskWriter,
  ) {}

  /** Adds suggestions to the queue. Returns the ones that were new; repeats are skipped by dedup key. */
  propose(rows: NewSuggestion[]): Promise<{ id: string; dedupKey: string }[]> {
    return this.repo.insertNew(rows);
  }

  pending(tenantId: string, limit = 50): Promise<Suggestion[]> {
    return this.repo.pending(tenantId, limit);
  }

  /**
   * Scoped by tenant in the query itself, idempotent on double-submit, and a
   * dismissed suggestion can never be revived by a stale tab.
   *
   * This service performs the accept for task suggestions. Summaries, reminders and
   * slot offers share the queue and its shape, but their accept actions (posting a
   * summary, sending a reminder, creating an invite) belong to the product modules
   * that own those things, so they are refused here rather than half done.
   */
  async accept(tenantId: string, id: string, userId: string, edits: AcceptEdits = {}): Promise<{ taskId: string }> {
    return this.repo.transaction(async (tx) => {
      const s = await this.repo.lockForDecision(tx, tenantId, id);
      if (!s) throw new NotFound(id);
      // a second click while the first was in flight: hand back the same task
      if (s.status === 'accepted' && s.createdTaskId) return { taskId: s.createdTaskId };
      if (s.status !== 'pending') throw new AlreadyDecided(id);
      if (s.type !== 'task') throw new NotAcceptableHere(id);
      const p = s.payload as { title: string; ownerId: string | null; due: string | null; quote: string };
      const task = await this.tasks.create({
        tenantId,
        title: edits.title ?? p.title,
        // `null` is a real edit ("unassign"), so only `undefined` falls back to the suggestion
        assigneeId: edits.assigneeId !== undefined ? edits.assigneeId : p.ownerId,
        dueDate: edits.dueDate !== undefined ? edits.dueDate : p.due,
        sourceQuote: p.quote,
      });
      await this.repo.markAccepted(tx, id, userId, task.id);
      return { taskId: task.id };
    });
  }

  /** Same rules as accept: not found is 404, already decided is 409, whichever way it went. */
  async dismiss(tenantId: string, id: string, userId: string): Promise<void> {
    await this.repo.transaction(async (tx) => {
      const s = await this.repo.lockForDecision(tx, tenantId, id);
      if (!s) throw new NotFound(id);
      if (s.status !== 'pending') throw new AlreadyDecided(id);
      await this.repo.markDismissed(tx, id, userId);
    });
  }
}
