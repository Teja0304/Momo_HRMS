import { Injectable, Logger } from '@nestjs/common';
import { FaceAiProvider, FaceVerificationResult } from '../interfaces/face-ai-provider.interface';

@Injectable()
export class MockFaceAiProvider implements FaceAiProvider {
  private readonly logger = new Logger(MockFaceAiProvider.name);

  async validateVerificationToken(
    employeeId: string,
    token: string,
  ): Promise<FaceVerificationResult> {
    this.logger.debug(`[MOCK] Validating face verification token for ${employeeId}`);
    if (!token || token.trim().length === 0) {
      return { valid: false, confidence: 0.0, message: 'Missing face verification token' };
    }
    return { valid: true, confidence: 0.95, message: 'Mock face verification passed' };
  }
}
