import { Module } from '@nestjs/common';
import { OPENROUTER_API_KEY, OPENROUTER_FETCH, OPENROUTER_SLEEP, OpenRouterClient } from '../../integrations/openrouter/openrouter.client';
import { AiRepository } from './ai.repository';
import { AiService } from './ai.service';

@Module({
  providers: [
    AiRepository,
    AiService,
    // built by a factory so the client itself stays a plain class with no Nest decorators
    {
      provide: OpenRouterClient,
      inject: [OPENROUTER_FETCH, OPENROUTER_API_KEY, OPENROUTER_SLEEP],
      useFactory: (fetch: typeof globalThis.fetch, key: string, sleep: (ms: number) => Promise<void>) => new OpenRouterClient(fetch, key, sleep),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
