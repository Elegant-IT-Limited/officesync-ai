import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';

/** Services throw these; controllers never catch them. The filter below maps them to HTTP once. */
export class DomainError extends Error {
  readonly status: number = HttpStatus.BAD_REQUEST;
}

// Also thrown for a row that exists in another workspace: saying "not yours" would
// confirm the id is real, so the caller only ever hears "not found".
export class NotFound extends DomainError {
  override readonly status = HttpStatus.NOT_FOUND;
}

export class AlreadyDecided extends DomainError {
  override readonly status = HttpStatus.CONFLICT;
}

// A suggestion whose accept action this service does not perform (see ReviewService.accept).
export class NotAcceptableHere extends DomainError {
  override readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
}

/** A failure the queue should retry later (provider outage, rate limit), not a bug. */
export class RetryableError extends Error {}

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>().status(error.status).json({ error: error.constructor.name });
  }
}
