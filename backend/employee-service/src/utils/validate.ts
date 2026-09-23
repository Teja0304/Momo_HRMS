import { z } from 'zod';

/**
 * Validates data (req.body / req.query / req.params) against a Zod schema.
 * On failure it throws a ZodError, which the central error handler converts
 * into a 400 response. On success you get a fully typed object back.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}

/** Path parameter /:id must be a UUID. */
export const idParamSchema = z.strictObject({
  id: z.uuid({ error: 'id must be a valid UUID' }),
});
