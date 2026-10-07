import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  getFaceChallenge,
  verifyFace,
  detectNeutral,
  detectAction,
} from '../api/faceApi';
import type { ChallengeResponse } from '../api/faceApi';
import { palette } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';
import { AppButton } from './AppButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = Math.min(SCREEN_WIDTH * 0.70, 270);
const OVAL_HEIGHT = OVAL_WIDTH * 1.32;

type LivenessStep = 'NEUTRAL' | 'ACTION' | 'VERIFYING' | 'SUCCESS';

interface FaceCameraModalProps {
  visible: boolean;
  mode: 'checkIn' | 'checkOut';
  employeeId: string;
  officeName?: string;
  onVerified: (verificationToken: string, photoUri?: string) => void;
  onCancel: () => void;
}

export function FaceCameraModal({
  visible,
  mode,
  employeeId,
  officeName,
  onVerified,
  onCancel,
}: FaceCameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);

  // Liveness Step Machine: NEUTRAL -> ACTION -> VERIFYING -> SUCCESS
  const [currentStep, setCurrentStep] = useState<LivenessStep>('NEUTRAL');
  const [stepPrompt, setStepPrompt] = useState<string>('Look directly into the camera');
  const [neutralDetected, setNeutralDetected] = useState(false);
  const [actionDetected, setActionDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState<number | null>(null);

  // Frames
  const [neutralFrame, setNeutralFrame] = useState<string | null>(null);
  const [neutralPreviewUri, setNeutralPreviewUri] = useState<string | null>(null);
  const [actionPreviewUri, setActionPreviewUri] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loop control refs to avoid closures or concurrency collisions
  const isAnalyzingRef = useRef(false);
  const neutralFrameRef = useRef<string | null>(null);
  const currentStepRef = useRef<LivenessStep>('NEUTRAL');
  const challengeRef = useRef<ChallengeResponse | null>(null);

  currentStepRef.current = currentStep;
  neutralFrameRef.current = neutralFrame;
  challengeRef.current = challenge;

  // Initialize or reset challenge on modal open
  useEffect(() => {
    let isMounted = true;

    if (visible && employeeId) {
      setErrorMessage(null);
      setCurrentStep('NEUTRAL');
      setNeutralDetected(false);
      setActionDetected(false);
      setDetectionConfidence(null);
      setNeutralFrame(null);
      setNeutralPreviewUri(null);
      setActionPreviewUri(null);
      setStepPrompt('Step 1 of 2: Look directly into camera to align face');
      setLoadingChallenge(true);

      getFaceChallenge(employeeId)
        .then((res) => {
          if (isMounted) {
            setChallenge(res);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setErrorMessage(getErrorMessage(err, 'Could not retrieve biometric challenge.'));
          }
        })
        .finally(() => {
          if (isMounted) {
            setLoadingChallenge(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [visible, employeeId]);

  const refreshChallenge = async () => {
    if (!employeeId) return;
    setLoadingChallenge(true);
    setErrorMessage(null);
    setCurrentStep('NEUTRAL');
    setNeutralDetected(false);
    setActionDetected(false);
    setDetectionConfidence(null);
    setNeutralFrame(null);
    setNeutralPreviewUri(null);
    setActionPreviewUri(null);
    setStepPrompt('Step 1 of 2: Look directly into camera to align face');

    try {
      const res = await getFaceChallenge(employeeId);
      setChallenge(res);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Failed to refresh challenge.'));
    } finally {
      setLoadingChallenge(false);
    }
  };

  // Continuous Real-Time Liveness Loop (Checks Neutral alignment, then micro-action)
  useEffect(() => {
    if (!visible || !isCameraReady || loadingChallenge || !challenge) {
      return;
    }

    const interval = setInterval(async () => {
      if (isAnalyzingRef.current || !cameraRef.current) {
        return;
      }

      const activeStep = currentStepRef.current;
      if (activeStep === 'VERIFYING' || activeStep === 'SUCCESS') {
        return;
      }

      isAnalyzingRef.current = true;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.45,
          base64: true,
          skipProcessing: true,
        });

        if (!photo || !photo.base64) {
          isAnalyzingRef.current = false;
          return;
        }

        // ── Phase 1: Detect Neutral Pose ──
        if (activeStep === 'NEUTRAL') {
          const res = await detectNeutral(photo.base64);
          if (res.detected) {
            setNeutralDetected(true);
            setNeutralFrame(photo.base64);
            setNeutralPreviewUri(photo.uri);
            neutralFrameRef.current = photo.base64;

            // Advance to Phase 2: Action Challenge
            setCurrentStep('ACTION');
            const actionLabel = getActionDisplay(challengeRef.current?.action || 'SMILE').label;
            setStepPrompt(`Step 2 of 2: ${actionLabel}! Auto-capturing when detected...`);
          } else if (res.message) {
            setStepPrompt(res.message);
          }
        }

        // ── Phase 2: Detect Active Micro-Action ──
        else if (activeStep === 'ACTION' && neutralFrameRef.current && challengeRef.current) {
          const res = await detectAction(
            challengeRef.current.action,
            neutralFrameRef.current,
            photo.base64,
          );

          if (res.detected) {
            setActionDetected(true);
            setDetectionConfidence(res.confidence);
            setActionPreviewUri(photo.uri);
            setCurrentStep('VERIFYING');
            setStepPrompt(`✓ ${res.message || 'Action verified! Matching profile...'}`);

            // Automatically proceed to final cryptographic biometric verification
            await finalizeVerification(neutralFrameRef.current, photo.base64, photo.uri);
          }
        }
      } catch {
        // Non-fatal preview frame error: loop continues
      } finally {
        isAnalyzingRef.current = false;
      }
    }, 650);

    return () => {
      clearInterval(interval);
    };
  }, [visible, isCameraReady, loadingChallenge, challenge]);

  // Finalize verification with the backend
  const finalizeVerification = async (neutralB64: string, actionB64: string, photoUri?: string) => {
    if (!challengeRef.current) return;

    setCurrentStep('VERIFYING');
    setErrorMessage(null);

    try {
      const verifyRes = await verifyFace(employeeId, challengeRef.current.challenge_id, [
        neutralB64,
        actionB64,
      ]);

      if (verifyRes.verified && verifyRes.verification_token) {
        setCurrentStep('SUCCESS');
        setTimeout(() => {
          onVerified(verifyRes.verification_token!, photoUri || actionPreviewUri || undefined);
        }, 900);
      } else {
        const failureReason =
          verifyRes.message || 'Liveness check or face match failed. Please try again.';
        setErrorMessage(failureReason);
        await refreshChallenge();
      }
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(err, 'Biometric verification failed. Please align your face and retry.'),
      );
      await refreshChallenge();
    }
  };

  // Manual Trigger Fallback (in case lighting prevents auto-detection)
  const handleManualTrigger = async () => {
    if (!cameraRef.current || !isCameraReady || currentStep === 'VERIFYING' || !challenge) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        base64: true,
      });

      if (!photo || !photo.base64) return;

      if (currentStep === 'NEUTRAL') {
        setNeutralDetected(true);
        setNeutralFrame(photo.base64);
        setNeutralPreviewUri(photo.uri);
        neutralFrameRef.current = photo.base64;
        setCurrentStep('ACTION');
        const actionLabel = getActionDisplay(challenge.action).label;
        setStepPrompt(`Step 2 of 2: ${actionLabel}! Auto-capturing when detected...`);
      } else if (currentStep === 'ACTION' && neutralFrameRef.current) {
        setActionDetected(true);
        setActionPreviewUri(photo.uri);
        await finalizeVerification(neutralFrameRef.current, photo.base64, photo.uri);
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Manual capture failed. Please retry.'));
    }
  };

  const getActionDisplay = (action: string) => {
    switch (action) {
      case 'BLINK':
        return {
          icon: 'eye-outline',
          label: 'Blink your eyes naturally',
          hint: 'Close and open your eyes clearly toward the camera',
        };
      case 'SMILE':
        return {
          icon: 'emoticon-happy-outline',
          label: 'Smile gently at the camera',
          hint: 'Smile visibly until green confirmation shows',
        };
      case 'TURN_LEFT':
        return {
          icon: 'arrow-left-bold-circle-outline',
          label: 'Turn your head slightly to the left',
          hint: 'Rotate head slightly left while staying in frame',
        };
      case 'TURN_RIGHT':
        return {
          icon: 'arrow-right-bold-circle-outline',
          label: 'Turn your head slightly to the right',
          hint: 'Rotate head slightly right while staying in frame',
        };
      default:
        return {
          icon: 'face-recognition',
          label: 'Look straight at camera',
          hint: 'Keep your face steady inside the oval guide',
        };
    }
  };

  const actionInfo = challenge ? getActionDisplay(challenge.action) : null;
  const modeTitle = mode === 'checkIn' ? 'Check-In Verification' : 'Check-Out Verification';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (currentStep !== 'VERIFYING') {
          onCancel();
        }
      }}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{modeTitle}</Text>
            {officeName ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                📍 {officeName}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={onCancel}
            disabled={currentStep === 'VERIFYING'}
            style={styles.closeBtn}
          >
            <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Permission Request if not granted */}
        {!permission?.granted ? (
          <View style={styles.permissionBox}>
            <MaterialCommunityIcons name="camera-off" size={48} color={palette.primary} />
            <Text style={styles.permissionHeading}>Camera Access Needed</Text>
            <Text style={styles.permissionSub}>
              Camera permission is required for live anti-spoofing face verification.
            </Text>
            <AppButton mode="contained" onPress={() => void requestPermission()} style={{ marginTop: 16 }}>
              Enable Camera
            </AppButton>
          </View>
        ) : (
          <View style={styles.body}>
            {/* Step 1 & 2 Progress Pills */}
            <View style={styles.stepperRow}>
              <View
                style={[
                  styles.stepPill,
                  currentStep === 'NEUTRAL' && styles.stepPillActive,
                  neutralDetected && styles.stepPillCompleted,
                ]}
              >
                <MaterialCommunityIcons
                  name={neutralDetected ? 'check-circle' : 'account-box-outline'}
                  size={15}
                  color={neutralDetected ? '#10B981' : currentStep === 'NEUTRAL' ? '#6366F1' : '#64748B'}
                />
                <Text
                  style={[
                    styles.stepPillText,
                    neutralDetected && { color: '#10B981', fontWeight: '700' },
                    currentStep === 'NEUTRAL' && { color: '#FFFFFF', fontWeight: '700' },
                  ]}
                >
                  1. Neutral Pose
                </Text>
              </View>

              <View
                style={[
                  styles.stepPill,
                  currentStep === 'ACTION' && styles.stepPillActive,
                  actionDetected && styles.stepPillCompleted,
                ]}
              >
                <MaterialCommunityIcons
                  name={actionDetected ? 'check-circle' : (actionInfo?.icon as any) || 'motion-sensor'}
                  size={15}
                  color={actionDetected ? '#10B981' : currentStep === 'ACTION' ? '#F59E0B' : '#64748B'}
                />
                <Text
                  style={[
                    styles.stepPillText,
                    actionDetected && { color: '#10B981', fontWeight: '700' },
                    currentStep === 'ACTION' && { color: '#FFFFFF', fontWeight: '700' },
                  ]}
                >
                  2. Liveness Task
                </Text>
              </View>
            </View>

            {/* Liveness Challenge Instruction Banner */}
            <View
              style={[
                styles.challengeCard,
                currentStep === 'ACTION' && { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.1)' },
              ]}
            >
              <View
                style={[
                  styles.challengeIconWrap,
                  currentStep === 'ACTION' && { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
                ]}
              >
                <MaterialCommunityIcons
                  name={(actionInfo?.icon as any) || 'shield-check'}
                  size={22}
                  color={currentStep === 'ACTION' ? '#F59E0B' : palette.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={[
                    styles.challengeLabel,
                    currentStep === 'ACTION' && { color: '#F59E0B' },
                  ]}
                >
                  {currentStep === 'ACTION' ? 'ACTION DETECTOR ACTIVE' : 'LIVENESS VERIFICATION'}
                </Text>
                {loadingChallenge ? (
                  <Text style={styles.challengeText}>Requesting dynamic security challenge...</Text>
                ) : (
                  <Text style={styles.challengeText}>
                    {currentStep === 'NEUTRAL'
                      ? 'Align face in oval looking directly at camera'
                      : actionInfo?.label || challenge?.instruction || 'Perform micro-action'}
                  </Text>
                )}
              </View>
              {loadingChallenge && (
                <ActivityIndicator size="small" color={palette.primary} style={{ marginLeft: 6 }} />
              )}
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={palette.error} />
                <Text style={styles.errorMsg} numberOfLines={2}>
                  {errorMessage}
                </Text>
                <TouchableOpacity onPress={refreshChallenge} style={styles.retryChallengeBtn}>
                  <MaterialCommunityIcons name="refresh" size={16} color={palette.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Live Camera Viewport */}
            <View style={styles.cameraFrameWrapper}>
              <View style={styles.cameraContainer}>
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="front"
                  onCameraReady={() => setIsCameraReady(true)}
                />

                {/* Face Positioning Oval with Dynamic Liveness States */}
                <View style={styles.ovalOverlay} pointerEvents="none">
                  <View
                    style={[
                      styles.ovalBorder,
                      currentStep === 'ACTION' && styles.ovalBorderAction,
                      (neutralDetected && currentStep === 'NEUTRAL') && styles.ovalBorderNeutralLocked,
                      (actionDetected || currentStep === 'SUCCESS') && styles.ovalBorderSuccess,
                      Boolean(errorMessage && currentStep !== 'VERIFYING') && styles.ovalBorderError,
                    ]}
                  >
                    <View style={[styles.corner, styles.cTL, currentStep === 'ACTION' && { borderColor: '#F59E0B' }]} />
                    <View style={[styles.corner, styles.cTR, currentStep === 'ACTION' && { borderColor: '#F59E0B' }]} />
                    <View style={[styles.corner, styles.cBL, currentStep === 'ACTION' && { borderColor: '#F59E0B' }]} />
                    <View style={[styles.corner, styles.cBR, currentStep === 'ACTION' && { borderColor: '#F59E0B' }]} />

                    {/* Step Icon Badge Center if in Action Mode */}
                    {currentStep === 'ACTION' && !actionDetected && (
                      <View style={styles.actionCenterPill}>
                        <MaterialCommunityIcons name={(actionInfo?.icon as any) || 'eye'} size={24} color="#F59E0B" />
                        <Text style={styles.actionCenterText}>{actionInfo?.label}</Text>
                      </View>
                    )}
                  </View>

                  {/* Real-time Dynamic Guidance Pill */}
                  <View style={styles.ovalPromptWrap}>
                    <Text style={styles.ovalPrompt}>
                      {currentStep === 'SUCCESS'
                        ? '✓ Verified Real Person!'
                        : currentStep === 'VERIFYING'
                        ? 'Analyzing Liveness & Matching...'
                        : stepPrompt}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Detected Pop */}
              {actionDetected && currentStep === 'VERIFYING' && (
                <View style={styles.actionDetectedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                  <Text style={styles.actionDetectedText}>Task Detected! Verifying...</Text>
                </View>
              )}

              {/* Verified Success Overlay */}
              {currentStep === 'SUCCESS' && (
                <View style={styles.successOverlay}>
                  <View style={styles.successIconCircle}>
                    <MaterialCommunityIcons name="check-bold" size={48} color="#FFFFFF" />
                  </View>
                  <Text style={styles.successText}>Liveness & Face Verified!</Text>
                  <Text style={styles.successSubtext}>Real presence confirmed (Anti-Spoofing Passed)</Text>
                </View>
              )}
            </View>

            {/* Bottom Controls / Auto-Capture Status */}
            <View style={styles.footer}>
              {currentStep === 'VERIFYING' ? (
                <View style={styles.verifyingStatus}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.verifyingStatusText}>Matching with profile...</Text>
                </View>
              ) : currentStep === 'SUCCESS' ? (
                <View style={styles.verifyingStatus}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                  <Text style={[styles.verifyingStatusText, { color: '#10B981' }]}>
                    Recording attendance session...
                  </Text>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={handleManualTrigger}
                    disabled={!isCameraReady || loadingChallenge}
                    activeOpacity={0.8}
                    style={[
                      styles.verifyShutterBtn,
                      currentStep === 'ACTION' && { borderColor: '#F59E0B' },
                      (!isCameraReady || loadingChallenge) && { opacity: 0.5 },
                    ]}
                  >
                    <View style={styles.verifyShutterInner}>
                      <MaterialCommunityIcons
                        name={currentStep === 'ACTION' ? (actionInfo?.icon as any) || 'camera' : 'face-recognition'}
                        size={30}
                        color={currentStep === 'ACTION' ? '#F59E0B' : palette.primary}
                      />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.tapPrompt}>
                    {currentStep === 'NEUTRAL'
                      ? 'Auto-detecting... or tap to lock pose'
                      : 'Auto-detecting task... or tap to confirm'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 10,
    backgroundColor: '#0F172A',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  stepperRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 6,
  },
  stepPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366F1',
  },
  stepPillCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  stepPillText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  permissionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  permissionSub: {
    fontSize: 13.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  challengeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#818CF8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  challengeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorMsg: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#FCA5A5',
    lineHeight: 16,
  },
  retryChallengeBtn: {
    padding: 6,
    marginLeft: 6,
  },
  cameraFrameWrapper: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  cameraContainer: {
    flex: 1,
  },
  ovalOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalBorder: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderStyle: 'dashed',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalBorderAction: {
    borderColor: '#F59E0B',
    borderStyle: 'solid',
    borderWidth: 3,
  },
  ovalBorderNeutralLocked: {
    borderColor: '#10B981',
    borderStyle: 'solid',
    borderWidth: 3,
  },
  ovalBorderSuccess: {
    borderColor: '#10B981',
    borderStyle: 'solid',
    borderWidth: 3.5,
  },
  ovalBorderError: {
    borderColor: palette.error,
    borderStyle: 'solid',
    borderWidth: 3,
  },
  actionCenterPill: {
    position: 'absolute',
    bottom: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  actionCenterText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#6366F1',
  },
  cTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  ovalPromptWrap: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  ovalPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    textAlign: 'center',
  },
  actionDetectedBadge: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  actionDetectedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  successText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  successSubtext: {
    fontSize: 13,
    color: '#A7F3D0',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  actionRow: {
    alignItems: 'center',
  },
  verifyShutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  verifyShutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapPrompt: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  verifyingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  verifyingStatusText: {
    marginLeft: 8,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
