import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FaceAiProvider, FaceVerificationResult } from '../interfaces/face-ai-provider.interface';
import { MockFaceAiProvider } from './mock-face-ai.provider';

@Injectable()
export class HttpFaceAiProvider implements FaceAiProvider {
  private readonly logger = new Logger(HttpFaceAiProvider.name);
  private readonly faceServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockFaceAiProvider,
  ) {
    this.faceServiceUrl = this.configService.get<string>(
      'FACE_SERVICE_URL',
      'http://localhost:3006/api/v1',
    );
  }

  async validateVerificationToken(
    employeeId: string,
    token: string,
  ): Promise<FaceVerificationResult> {
    const isMock = this.configService.get<string>('FACE_USE_MOCK', 'false') === 'true';
    if (isMock) {
      return this.mockProvider.validateVerificationToken(employeeId, token);
    }

    if (!token || token.trim().length === 0) {
      return { valid: false, confidence: 0.0, message: 'Face verification token is required' };
    }

    try {
      const response = await fetch(`${this.faceServiceUrl}/face/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gateway-secret': this.configService.get<string>('GATEWAY_SHARED_SECRET', 'dev-gateway-secret'),
        },
        body: JSON.stringify({
          employee_id: employeeId,
          verification_token: token,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Face AI service responded with status ${response.status}`);
        return {
          valid: false,
          confidence: 0.0,
          message: `Face verification service rejected token (HTTP ${response.status})`,
        };
      }

      const body = (await response.json()) as { valid: boolean; confidence: number; message: string };
      return {
        valid: body.valid,
        confidence: body.confidence,
        message: body.message,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to reach Face AI service at ${this.faceServiceUrl}: ${(error as Error).message}`,
      );
      // If configured to allow fallback in emergency, otherwise fail closed
      if (this.configService.get<string>('FACE_FAIL_CLOSED', 'true') === 'false') {
        this.logger.warn('Falling back to mock face verification because FACE_FAIL_CLOSED=false');
        return this.mockProvider.validateVerificationToken(employeeId, token);
      }
      return {
        valid: false,
        confidence: 0.0,
        message: 'Face verification service is currently unreachable',
      };
    }
  }
}
