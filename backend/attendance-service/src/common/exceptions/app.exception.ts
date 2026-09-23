import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

/**
 * Every business-rule rejection (as opposed to a raw validation failure)
 * should throw this, not a bare HttpException, so the response body
 * always carries a stable machine-readable `code` the mobile/admin
 * clients can branch on, not just a human-readable message.
 */
export class AppException extends HttpException {
  constructor(code: ErrorCode, message: string, status: HttpStatus = HttpStatus.CONFLICT) {
    super({ code, message }, status);
  }
}
