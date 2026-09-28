import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_MESSAGE_METADATA } from '../decorators/api-message.decorator';

export interface ApiResponseEnvelope<T> {
  success: true;
  data: T;
  message?: string;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiResponseEnvelope<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseEnvelope<T> | T> {
    const message = this.reflector.get<string | undefined>(
      API_MESSAGE_METADATA,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in (data as Record<string, unknown>)) {
          return data;
        }
        const envelope: ApiResponseEnvelope<T> = { success: true, data };
        if (message) {
          envelope.message = message;
        }
        return envelope;
      }),
    );
  }
}
