import { Module } from '@nestjs/common';
import { OPENROUTER_API_KEY, OPENROUTER_FETCH, OpenRouterClient } from '../../integrations/openrouter/openrouter.client';
import { AiRepository } from './ai.repository';
import { AiService } from './ai.service';

@Module({
  providers: [
    AiRepository,
    AiService,
    // built by a factory so the client itself stays a plain class with no Nest decorators
    {
      provide: OpenRouterClient,
      inject: [OPENROUTER_FETCH, OPENROUTER_API_KEY],
      useFactory: (fetch: typeof globalThis.fetch, key: string) => new OpenRouterClient(fetch, key),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
