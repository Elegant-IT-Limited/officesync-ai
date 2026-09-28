import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type DB } from '../../db/client';
import { aiCalls } from './ai.table';

export interface CallRecord {
  tenantId: string; stage: string; modelUsed: string; attempts: number;
  promptTokens: number; completionTokens: number; costUsd: number;
}

/** The ledger behind cost reporting. Append-only: a call that happened is never edited or removed. */
@Injectable()
export class AiRepository {
  constructor(@Inject(DATABASE) private readonly db: DB) {}

  async recordCall(c: CallRecord): Promise<void> {
    await this.db.insert(aiCalls).values({ ...c, costUsd: c.costUsd.toFixed(6) });
  }
}
