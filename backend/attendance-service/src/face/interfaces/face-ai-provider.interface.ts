export const FACE_AI_PROVIDER = 'FACE_AI_PROVIDER';

export interface FaceVerificationResult {
  valid: boolean;
  confidence: number;
  message: string;
}

export interface FaceAiProvider {
  /**
   * Verifies that the provided verification token is valid, fresh,
   * and belongs to the specified employee.
   */
  validateVerificationToken(
    employeeId: string,
    token: string,
  ): Promise<FaceVerificationResult>;
}
