import { SetMetadata } from '@nestjs/common';

export const API_MESSAGE_KEY = 'apiMessage';

/**
 * Sets the `message` field of the success envelope
 * ({ success: true, data, message }) for this route.
 */
export const ApiMessage = (message: string) => SetMetadata(API_MESSAGE_KEY, message);
