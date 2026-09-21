import axios from 'axios';
import type { ApiErrorBody } from '../types/auth';

/** Turns any thrown value into a short message that is safe to show to a user. */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return error.code === 'ECONNABORTED'
        ? 'The server took too long to respond. Please try again.'
        : 'Unable to reach the server. Check your connection and the API address.';
    }

    const { status, data } = error.response;
    if (status === 429) return 'Too many attempts. Please wait a minute and try again.';

    const message = data?.message;
    if (Array.isArray(message) && message.length > 0) return message.join('\n');
    if (typeof message === 'string' && message.length > 0) return message;
    if (status >= 500) return 'The server had a problem. Please try again later.';
    return fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
