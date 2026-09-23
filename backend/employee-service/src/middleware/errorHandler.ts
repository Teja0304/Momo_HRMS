import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../lib/logger';

/** Unknown URL -> 404 in our normal error format. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
};

function send(res: Parameters<ErrorRequestHandler>[2], status: number, code: string, message: string, details?: unknown): void {
  res.status(status).json({
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

/**
 * The ONE place where errors become HTTP responses.
 * Rules: never leak stack traces, SQL, tokens or passwords to the client.
 * Unexpected errors are logged on the server (with the stack) and the client
 * only sees a generic 500 message.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ZodError) {
    send(
      res,
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
    return;
  }

  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Safety net: services check for duplicates first, but two requests can race.
    if (err.code === 'P2002') {
      send(res, 409, 'DUPLICATE_VALUE', 'A record with the same unique value already exists');
      return;
    }
    if (err.code === 'P2025') {
      send(res, 404, 'NOT_FOUND', 'The requested record was not found');
      return;
    }
    if (err.code === 'P2003') {
      send(res, 409, 'RELATED_RECORD_CONSTRAINT', 'The operation conflicts with a related record');
      return;
    }
  }

  // body-parser errors: bad JSON / body too large
  const httpError = err as { type?: string; status?: number };
  if (httpError.type === 'entity.parse.failed') {
    send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
    return;
  }
  if (httpError.type === 'entity.too.large') {
    send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    return;
  }

  logger.error({ err }, 'Unhandled error');
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong on the server');
};
