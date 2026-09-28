import { DynamicModule, Global, Module } from '@nestjs/common';
import { DATABASE, type DB } from '../db/client';
import { GRAPH_CALENDAR, type GraphCalendar } from '../integrations/microsoft-graph/graph-calendar.client';
import { TASK_WRITER, type TaskWriter } from '../integrations/officesyncpro/tasks.client';
import { OPENROUTER_API_KEY, OPENROUTER_FETCH } from '../integrations/openrouter/openrouter.client';
import { ENV, type Env } from './config';
import { TENANT_DIRECTORY, type TenantDirectory } from './tenancy';

/**
 * Everything the modules need from outside the process, bound in one place.
 * main.ts binds the real clients; tests bind recorded ones. No module constructs
 * its own database connection or HTTP client.
 */
export interface CoreOptions {
  env: Pick<Env, 'SESSION_SECRET'> & Partial<Env>;
  db: DB;
  openrouterFetch: typeof globalThis.fetch;
  openrouterApiKey: string;
  taskWriter: TaskWriter;
  graphCalendar: GraphCalendar;
  tenantDirectory: TenantDirectory;
}

@Global()
@Module({})
export class CoreModule {
  static forRoot(o: CoreOptions): DynamicModule {
    const providers = [
      { provide: ENV, useValue: o.env },
      { provide: DATABASE, useValue: o.db },
      { provide: OPENROUTER_FETCH, useValue: o.openrouterFetch },
      { provide: OPENROUTER_API_KEY, useValue: o.openrouterApiKey },
      { provide: TASK_WRITER, useValue: o.taskWriter },
      { provide: GRAPH_CALENDAR, useValue: o.graphCalendar },
      { provide: TENANT_DIRECTORY, useValue: o.tenantDirectory },
    ];
    return { module: CoreModule, providers, exports: providers.map((p) => p.provide) };
  }
}
