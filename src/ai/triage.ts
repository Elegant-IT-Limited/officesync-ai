import { z } from 'zod';
import { complete, type ModelDeps } from './openrouter';
import type { Ctx } from './types';

export const Triage = z.object({
  kind: z.enum(['request', 'decision', 'scheduling', 'fyi', 'personal', 'other']),
  priority: z.enum(['high', 'normal', 'low']),
  needs_reply: z.boolean(),
  has_scheduling_ask: z.boolean(),
  reason: z.string().max(160),
});
export type Triage = z.infer<typeof Triage>;

const SYSTEM = `Classify one work email for a project team.
kind: request (someone is asked to do something), decision (something was decided or approved),
scheduling (the main point is finding a time), fyi, personal, other.
priority: high only for a stated deadline within 2 working days, a blocker, or a client escalation.
needs_reply: the sender expects an answer from a recipient.
has_scheduling_ask: the email asks to find a time to meet, even if that is not its main point.`;

export const triage = (deps: ModelDeps, ctx: Ctx, subject: string, text: string) =>
  complete(deps, ctx, 'triage', Triage, SYSTEM, `Subject: ${subject}\n\n${text}`);
