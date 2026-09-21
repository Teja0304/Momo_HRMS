import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const SENSITIVE_FIELDS = ['passwordHash', 'password_hash', 'tokenHash', 'token_hash'];

function stripSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveFields);
  }

  if (value !== null && typeof value === 'object') {
    const clone: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const field of SENSITIVE_FIELDS) {
      delete clone[field];
    }
    for (const key of Object.keys(clone)) {
      clone[key] = stripSensitiveFields(clone[key]);
    }
    return clone;
  }

  return value;
}

/**
 * Defense-in-depth: even if a service method accidentally returns a raw
 * Prisma entity containing passwordHash/tokenHash, this interceptor strips
 * those fields before the response leaves the process. DTOs/`select`
 * clauses remain the primary mechanism — this is a safety net, not a
 * substitute for them.
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => stripSensitiveFields(data)));
  }
}
