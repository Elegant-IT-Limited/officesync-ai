import { z } from 'zod';

/**
 * Environment, validated once at startup. A missing key fails the boot with a clear
 * message instead of failing the first job that happens to need it.
 */
const Env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  OPENROUTER_API_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  OFFICESYNCPRO_API_URL: z.string().url(),
  OFFICESYNCPRO_API_TOKEN: z.string().min(1),
  GRAPH_TOKEN_URL: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
});
export type Env = z.infer<typeof Env>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`invalid environment: ${missing}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
