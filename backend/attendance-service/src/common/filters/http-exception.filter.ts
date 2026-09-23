import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodes } from '../constants/error-codes';
import { ApiErrorResponse } from '../dto/api-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
        code = this.codeForStatus(status);
      } else if (typeof body === 'object' && body !== null) {
        const typedBody = body as {
          code?: string;
          message?: string | string[];
          error?: string;
        };

        // AppException already sets { code, message }.
        if (typedBody.code) {
          code = typedBody.code;
          message = Array.isArray(typedBody.message)
            ? typedBody.message.join('; ')
            : (typedBody.message ?? exception.message);
        } else {
          // Nest's built-in ValidationPipe error shape: { message: string[], error: 'Bad Request' }
          code = this.codeForStatus(status);
          if (Array.isArray(typedBody.message)) {
            message = 'Request validation failed';
            details = typedBody.message;
          } else {
            message = typedBody.message ?? exception.message;
          }
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    };

    this.logger.warn(`${request.method} ${request.url} -> ${status} ${code}`);
    response.status(status).json(errorResponse);
  }

  private codeForStatus(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.SESSION_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCodes.CONFLICT;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
