import axios from 'axios';
import type { ApiErrorBody } from '../types/auth';
import { API_URL } from '../config/env';

/** Turns any thrown value into a short message that is safe to show to a user. */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      const target = error.config?.baseURL || API_URL;
      return error.code === 'ECONNABORTED'
        ? `The server took too long to respond (${target}). Please try again.`
        : `Unable to reach backend (${target}). Ensure phone and PC are on the same Wi-Fi.`;
    }

    const { status, data } = error.response as any;
    if (status === 429) return 'Too many attempts. Please wait a minute and try again.';

    // Check microservice nested error format (e.g. employee-service)
    if (data?.error && typeof data.error === 'object') {
      if (Array.isArray(data.error.details) && data.error.details.length > 0) {
        return data.error.details
          .map((d: any) => (d.message ? `${d.path ? d.path + ': ' : ''}${d.message}` : String(d)))
          .join('\n');
      }
      if (typeof data.error.message === 'string' && data.error.message.length > 0) {
        return data.error.message;
      }
    }

    const message = data?.message;
    if (Array.isArray(message) && message.length > 0) return message.join('\n');
    if (typeof message === 'string' && message.length > 0) return message;
    if (typeof data?.error === 'string' && data.error.length > 0) return data.error;

    if (status >= 500) return 'The server had a problem. Please try again later.';
    return fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
