import { CanActivate, createParamDecorator, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENV, type Env } from './config';

export interface Session { tenantId: string; userId: string }

/**
 * The webapp sends `Authorization: Bearer <tenantId>:<userId>.<hmac>`. In the product
 * the session comes from the auth module; the reference build signs a minimal token
 * so tests need no identity provider. Either way the tenant and the user are taken
 * from a verified token, never from the request body or a query string.
 */
export function signSession(s: Session, secret: string): string {
  const subject = `${s.tenantId}:${s.userId}`;
  return `${subject}.${createHmac('sha256', secret).update(subject).digest('hex')}`;
}

export function verifySession(token: string, secret: string): Session | null {
  const [tenantId, userId] = (token.split('.')[0] ?? '').split(':');
  if (!tenantId || !userId) return null;
  const expected = Buffer.from(signSession({ tenantId, userId }, secret));
  const given = Buffer.from(token);
  // timingSafeEqual throws on different lengths, so check that first
  return given.length === expected.length && timingSafeEqual(given, expected) ? { tenantId, userId } : null;
}

type SessionRequest = { headers: Record<string, string | undefined>; session?: Session };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Pick<Env, 'SESSION_SECRET'>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<SessionRequest>();
    const session = verifySession((req.headers.authorization ?? '').replace(/^Bearer /, ''), this.env.SESSION_SECRET);
    if (!session) throw new UnauthorizedException();
    req.session = session;
    return true;
  }
}

/** The verified session, for use as a controller parameter. Only valid behind SessionGuard. */
export const CurrentSession = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<SessionRequest>().session!);
