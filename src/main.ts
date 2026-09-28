import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './core/config';
import { connectPostgres } from './db/client';
import { HttpGraphCalendar } from './integrations/microsoft-graph/graph-calendar.client';
import { HttpTaskWriter } from './integrations/officesyncpro/tasks.client';
import { HttpTenantDirectory } from './integrations/officesyncpro/workspace.client';
import { WorkersModule } from './workers/workers.module';

/** Composition root: reads the environment, binds the real clients, starts HTTP and the queue workers. */
async function bootstrap() {
  const env = loadEnv();
  // Graph tokens are issued by OfficeSyncPro, which already holds each tenant's consent.
  const graphToken = async (organizer: string) => {
    const res = await fetch(`${env.GRAPH_TOKEN_URL}?user=${encodeURIComponent(organizer)}`, { headers: { authorization: `Bearer ${env.OFFICESYNCPRO_API_TOKEN}` } });
    if (!res.ok) throw new Error(`graph token: HTTP ${res.status}`);
    return ((await res.json()) as { accessToken: string }).accessToken;
  };
  const app = await NestFactory.create(AppModule.forRoot({
    env,
    db: connectPostgres(env.DATABASE_URL),
    openrouterFetch: fetch,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    taskWriter: new HttpTaskWriter(env.OFFICESYNCPRO_API_URL, env.OFFICESYNCPRO_API_TOKEN),
    graphCalendar: new HttpGraphCalendar(graphToken),
    tenantDirectory: new HttpTenantDirectory(env.OFFICESYNCPRO_API_URL, env.OFFICESYNCPRO_API_TOKEN),
  }, [WorkersModule.forRoot(env.REDIS_URL)]));
  app.enableShutdownHooks(); // lets in-flight jobs finish on deploy
  await app.listen(env.PORT);
}

bootstrap().catch((err) => {
  // a bad env or an unreachable dependency: say so and exit, so the orchestrator restarts us
  console.error(err);
  process.exit(1);
});
