import { faceClient } from './client';
import { GATEWAY_URL } from '../config/env';
import axios from 'axios';

export interface FaceStatusResponse {
  employee_id: string;
  is_enrolled: boolean;
  enrolled_at?: string | null;
  last_verified_at?: string | null;
}

export interface FaceEnrollResponse {
  success: boolean;
  employee_id: string;
  message: string;
}

export interface ChallengeResponse {
  challenge_id: string;
  employee_id: string;
  action: string;
  instruction: string;
  expires_in_seconds: number;
}

export interface FaceVerifyResponse {
  verified: boolean;
  confidence: number;
  is_live: boolean;
  verification_token: string | null;
  message: string;
}

export interface DetectNeutralResponse {
  detected: boolean;
  message: string;
}

/**
 * Checks if the employee already has an active face biometric enrollment.
 */
export async function getFaceStatus(employeeId: string): Promise<FaceStatusResponse> {
  try {
    const { data } = await faceClient.get<FaceStatusResponse>(
      `/face/status/${encodeURIComponent(employeeId)}`,
    );
    return data;
  } catch (err) {
    // Attempt fallback via API Gateway if direct service is behind gateway
    try {
      const { data } = await axios.get<FaceStatusResponse>(
        `${GATEWAY_URL}/face/status/${encodeURIComponent(employeeId)}`,
        { timeout: 8000 },
      );
      return data;
    } catch {
      // Re-throw original error
      throw err;
    }
  }
}

/**
 * Registers an employee's face photo into face-ai-service.
 * Passive anti-spoofing and deep SFace embedding extraction are performed server-side.
 */
export async function enrollFace(
  employeeId: string,
  imageBase64: string,
): Promise<FaceEnrollResponse> {
  const payload = {
    employee_id: employeeId,
    image_base64: imageBase64,
  };

  try {
    const { data } = await faceClient.post<FaceEnrollResponse>('/face/enroll', payload);
    return data;
  } catch (err) {
    try {
      const { data } = await axios.post<FaceEnrollResponse>(`${GATEWAY_URL}/face/enroll`, payload, {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json' },
      });
      return data;
    } catch {
      throw err;
    }
  }
}

/**
 * Requests an active challenge from face-ai-service for anti-spoofing verification.
 */
export async function getFaceChallenge(employeeId: string): Promise<ChallengeResponse> {
  try {
    const { data } = await faceClient.get<ChallengeResponse>('/face/challenge', {
      params: { employee_id: employeeId },
    });
    return data;
  } catch (err) {
    try {
      const { data } = await axios.get<ChallengeResponse>(`${GATEWAY_URL}/face/challenge`, {
        params: { employee_id: employeeId },
        timeout: 10000,
      });
      return data;
    } catch {
      throw err;
    }
  }
}

/**
 * Verifies a live face capture sequence against the employee's enrolled biometrics.
 * Upon success, issues a cryptographically signed verification_token.
 */
export async function verifyFace(
  employeeId: string,
  challengeId: string,
  frames: string[],
): Promise<FaceVerifyResponse> {
  const payload = {
    employee_id: employeeId,
    challenge_id: challengeId,
    frames,
  };

  try {
    const { data } = await faceClient.post<FaceVerifyResponse>('/face/verify', payload);
    return data;
  } catch (err) {
    try {
      const { data } = await axios.post<FaceVerifyResponse>(`${GATEWAY_URL}/face/verify`, payload, {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json' },
      });
      return data;
    } catch {
      throw err;
    }
  }
}

/**
 * Continuous preview check to detect whether a centered neutral face is present in the frame.
 */
export async function detectNeutral(currentFrame: string): Promise<DetectNeutralResponse> {
  try {
    const { data } = await faceClient.post<DetectNeutralResponse>('/face/detect-neutral', {
      current_frame: currentFrame,
    });
    return data;
  } catch {
    try {
      const { data } = await axios.post<DetectNeutralResponse>(
        `${GATEWAY_URL}/face/detect-neutral`,
        { current_frame: currentFrame },
        { timeout: 8000, headers: { 'Content-Type': 'application/json' } },
      );
      return data;
    } catch {
      return { detected: false, message: 'Detection unavailable' };
    }
  }
}

export interface DetectActionResponse {
  detected: boolean;
  action: string;
  confidence: number;
  message: string;
}

/**
 * Continuous action check to evaluate whether the user performed the requested micro-action
 * (BLINK, SMILE, TURN_LEFT, TURN_RIGHT) relative to the neutral reference photo.
 */
export async function detectAction(
  action: string,
  neutralFrame: string,
  currentFrame: string,
): Promise<DetectActionResponse> {
  const payload = {
    action,
    neutral_frame: neutralFrame,
    current_frame: currentFrame,
  };
  try {
    const { data } = await faceClient.post<DetectActionResponse>('/face/detect-action', payload);
    return data;
  } catch {
    try {
      const { data } = await axios.post<DetectActionResponse>(
        `${GATEWAY_URL}/face/detect-action`,
        payload,
        { timeout: 8000, headers: { 'Content-Type': 'application/json' } },
      );
      return data;
    } catch {
      return { detected: false, action, confidence: 0, message: 'Action detection unavailable' };
    }
  }
}
