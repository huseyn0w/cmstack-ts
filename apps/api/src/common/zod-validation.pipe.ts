import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates and parses a request payload against a shared Zod schema at the API
 * boundary. On failure it returns a 400 with a readable, field-level message.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(body)'}: ${issue.message}`,
      );
      throw new BadRequestException(message);
    }
    return result.data;
  }
}
