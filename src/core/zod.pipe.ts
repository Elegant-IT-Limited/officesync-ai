import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Validates a request body against a zod schema, the same library the model contracts use. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return parsed.data;
  }
}
