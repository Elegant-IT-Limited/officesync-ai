import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import type { DB } from '../../src/db/client';
import { openTestDb } from './db';
import type { GraphCalendar } from '../../src/integrations/microsoft-graph/graph-calendar.client';
import type { TaskWriter } from '../../src/integrations/officesyncpro/tasks.client';
import { ctx } from './fixtures';

export const SESSION_SECRET = 'test-session-secret-0123456789';

const open: { close(): Promise<void> }[] = [];

/** Closes every module compiled by testApp(). Called from test/support/teardown.ts. */
export async function closeTestApps(): Promise<void> {
  await Promise.all(open.splice(0).map((m) => m.close()));
}

const noCalendar: GraphCalendar = { async findMeetingTimes() { throw new Error('graph not expected in this test'); } };
const noTasks: TaskWriter = { async create() { throw new Error('task writer not expected in this test'); } };

/**
 * The real module graph, compiled by Nest, with recorded clients bound at the edges.
 * Every spec that goes through here also proves the dependency wiring still resolves.
 */
export async function testApp(o: { fetch: typeof globalThis.fetch; graph?: GraphCalendar; tasks?: TaskWriter; db?: DB }) {
  const db = o.db ?? (await openTestDb());
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot({
      env: { SESSION_SECRET },
      db,
      openrouterFetch: o.fetch,
      openrouterApiKey: 'sk-or-test',
      openrouterSleep: async () => {}, // retries are exercised, their backoff is not
      taskWriter: o.tasks ?? noTasks,
      graphCalendar: o.graph ?? noCalendar,
      tenantDirectory: { load: async (tenantId) => ctx({ tenantId }) },
    })],
  }).compile();
  open.push(moduleRef);
  return { db, moduleRef, get: moduleRef.get.bind(moduleRef) };
}

/** The same graph as an HTTP app on a random local port, for route tests. */
export async function testServer(o: Parameters<typeof testApp>[0]) {
  const app = await testApp(o);
  const http = app.moduleRef.createNestApplication({ logger: false });
  await http.listen(0, '127.0.0.1');
  open.push(http);
  const { port } = http.getHttpServer().address() as { port: number };
  return { ...app, url: `http://127.0.0.1:${port}` };
}
