import { z } from 'zod';

/** Small reusable Zod building blocks shared by several modules. */

export const uuid = (label: string) => z.uuid({ error: `${label} must be a valid UUID` });

export const text = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Invalid email address' }).max(255));

export const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s\-()]{5,28}$/, 'Invalid phone number (digits, spaces, dashes and brackets; optional leading +)');

/** "YYYY-MM-DD" from the client, a Date (UTC midnight) inside the service. */
export const dateOnly = z.iso.date({ error: 'Date must be in YYYY-MM-DD format' }).transform((value) => new Date(`${value}T00:00:00.000Z`));

export const httpUrl = z.url({ protocol: /^https?$/, error: 'Must be a valid http(s) URL' }).max(500);

/** Optional reason text sent with status changes. */
export const reasonField = text(500);
