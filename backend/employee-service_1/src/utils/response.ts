import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Every successful response looks like { success: true, data, meta? } */
export function sendOk<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function sendPage<T>(res: Response, data: T[], meta: PageMeta): void {
  res.status(200).json({ success: true, data, meta });
}
