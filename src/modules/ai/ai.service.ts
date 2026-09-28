import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { TenantCtx } from '../../core/tenancy';
import { OpenRouterClient } from '../../integrations/openrouter/openrouter.client';
import { AiRepository } from './ai.repository';
import { GUARD, ROUTES, type Stage } from './ai.routes';

/**
 * The single entry point for every model call in the pipeline. Each call goes out
 * with the stage's route and the injection guard, comes back validated against the
 * stage's zod contract, and is written to the ledger with the model that actually
 * answered. No other module talks to OpenRouter.
 */
@Injectable()
export class AiService {
  constructor(
    @Inject(OpenRouterClient) private readonly openrouter: OpenRouterClient,
    @Inject(AiRepository) private readonly repo: AiRepository,
  ) {}

  async complete<S extends z.ZodType>(ctx: TenantCtx, stage: Stage, schema: S, system: string, source: string): Promise<{ data: z.infer<S>; model: string }> {
    const route = ROUTES[stage];
    const r = await this.openrouter.complete({ name: stage, models: route.models, maxTokens: route.maxTokens, system: `${system}\n\n${GUARD}`, source, schema });
    await this.repo.recordCall({
      tenantId: ctx.tenantId, stage, modelUsed: r.model, attempts: r.attempts,
      promptTokens: r.promptTokens, completionTokens: r.completionTokens, costUsd: r.costUsd,
    });
    return { data: r.data as z.infer<S>, model: r.model };
  }
}
