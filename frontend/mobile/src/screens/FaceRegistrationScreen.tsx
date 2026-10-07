import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { enrollFace } from '../api/faceApi';
import { palette } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';
import { AppButton } from '../components/AppButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVAL_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 280);
const OVAL_HEIGHT = OVAL_WIDTH * 1.35;

export default function FaceRegistrationScreen() {
  const { user, employeeProfile, setFaceEnrolledManually, logout } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const empId =
    employeeProfile?.employeeCode ||
    employeeProfile?.id ||
    user?.id ||
    '';

  const employeeName =
    employeeProfile?.firstName && employeeProfile?.lastName
      ? `${employeeProfile.firstName} ${employeeProfile.lastName}`
      : employeeProfile?.firstName || user?.email || 'Employee';

  // Permission handling
  if (!permission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <MaterialCommunityIcons name="face-recognition" size={48} color={palette.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionBody}>
            Momo HRMS requires camera access to register your facial biometrics. This enables
            secure, touchless attendance verification when you check in at your workplace.
          </Text>

          <AppButton
            mode="contained"
            onPress={async () => {
              const res = await requestPermission();
              if (!res.granted && !res.canAskAgain) {
                Alert.alert(
                  'Permission Blocked',
                  'Camera permission was permanently denied. Please enable camera access in your device settings to proceed.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                  ],
                );
              }
            }}
            style={styles.permissionBtn}
          >
            Grant Camera Access
          </AppButton>

          <TouchableOpacity style={styles.signOutBtn} onPress={() => void logout()}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle Photo Capture
  const handleCapture = async () => {
    if (!cameraRef.current || !isCameraReady || isEnrolling) return;

    try {
      setErrorMessage(null);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (photo && photo.base64) {
        setCapturedPhoto({
          uri: photo.uri,
          base64: photo.base64,
        });
      } else {
        Alert.alert('Capture Error', 'Failed to capture photo data. Please try again.');
      }
    } catch (err: unknown) {
      Alert.alert('Capture Failed', getErrorMessage(err, 'Unable to capture picture.'));
    }
  };

  // Handle Retake
  const handleRetake = () => {
    setCapturedPhoto(null);
    setErrorMessage(null);
  };

  // Handle Confirm & Enroll
  const handleEnroll = async () => {
    if (!capturedPhoto || !capturedPhoto.base64 || isEnrolling) return;

    if (!empId) {
      Alert.alert('Error', 'Employee identification could not be verified. Please log in again.');
      return;
    }

    setIsEnrolling(true);
    setErrorMessage(null);

    try {
      const response = await enrollFace(empId, capturedPhoto.base64);

      if (response && response.success) {
        setIsSuccess(true);
        setTimeout(() => {
          setFaceEnrolledManually(true);
        }, 1200);
      } else {
        const msg = response?.message || 'Biometric enrollment failed. Please retake photo.';
        setErrorMessage(msg);
        Alert.alert('Enrollment Incomplete', msg);
      }
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(
        err,
        'Face enrollment failed. Please ensure your face is well-lit, centered, and unobstructed.',
      );
      setErrorMessage(errorMsg);
      Alert.alert('Registration Failed', errorMsg, [
        { text: 'Retake', onPress: handleRetake },
      ]);
    } finally {
      setIsEnrolling(false);
    }
  };

  // Success view
  if (isSuccess) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <View style={styles.successCircle}>
          <MaterialCommunityIcons name="check" size={60} color="#FFFFFF" />
        </View>
        <Text style={styles.successTitle}>Face Enrolled Successfully!</Text>
        <Text style={styles.successSubtitle}>
          Your biometric profile has been verified and registered. You can now use touchless
          face recognition to check in and check out.
        </Text>
        <ActivityIndicator size="small" color={palette.success} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Biometric Face Setup</Text>
          <Text style={styles.headerSubtitle}>
            Welcome, {employeeName} ({empId})
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
            ]);
          }}
          style={styles.headerSignOut}
        >
          <MaterialCommunityIcons name="logout" size={20} color={palette.muted} />
        </TouchableOpacity>
      </View>

      {/* Instructions Banner */}
      <View style={styles.instructionsCard}>
        <MaterialCommunityIcons name="information" size={20} color={palette.primary} />
        <Text style={styles.instructionsText}>
          Position your face directly inside the oval. Ensure good lighting and remove glasses,
          masks, or hats.
        </Text>
      </View>

      {/* Error Banner if any */}
      {errorMessage && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={18} color={palette.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Camera / Preview Viewport */}
      <View style={styles.cameraWrapper}>
        {capturedPhoto ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} />
            <View style={styles.capturedBadge}>
              <MaterialCommunityIcons name="check-circle" size={16} color={palette.success} />
              <Text style={styles.capturedBadgeText}>Face Photo Captured</Text>
            </View>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              onCameraReady={() => setIsCameraReady(true)}
            />

            {/* Oval Face Guide Overlay */}
            <View style={styles.overlayContainer} pointerEvents="none">
              <View style={styles.ovalGuide}>
                {/* Corner Guide Accents */}
                <View style={[styles.cornerMarker, styles.cornerTL]} />
                <View style={[styles.cornerMarker, styles.cornerTR]} />
                <View style={[styles.cornerMarker, styles.cornerBL]} />
                <View style={[styles.cornerMarker, styles.cornerBR]} />
              </View>
              <Text style={styles.guideInstruction}>Fit your face within the oval</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        {capturedPhoto ? (
          <View style={styles.confirmActionsRow}>
            <AppButton
              mode="outlined"
              onPress={handleRetake}
              disabled={isEnrolling}
              icon="camera-retake"
              style={styles.retakeBtn}
            >
              Retake
            </AppButton>
            <AppButton
              mode="contained"
              onPress={handleEnroll}
              loading={isEnrolling}
              disabled={isEnrolling}
              icon="face-recognition"
              style={styles.enrollBtn}
            >
              Confirm & Enroll
            </AppButton>
          </View>
        ) : (
          <View style={styles.shutterContainer}>
            <TouchableOpacity
              onPress={handleCapture}
              disabled={!isCameraReady}
              activeOpacity={0.8}
              style={[
                styles.shutterButtonOuter,
                !isCameraReady && { opacity: 0.5 },
              ]}
            >
              <View style={styles.shutterButtonInner}>
                <MaterialCommunityIcons name="camera" size={32} color={palette.primary} />
              </View>
            </TouchableOpacity>
            <Text style={styles.shutterHint}>Tap to capture</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: palette.muted,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionBtn: {
    width: '100%',
    borderRadius: 12,
  },
  signOutBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerSignOut: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  instructionsText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12.5,
    color: '#1E40AF',
    lineHeight: 18,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12.5,
    color: palette.error,
    lineHeight: 17,
  },
  cameraWrapper: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalGuide: {
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
  cornerMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: palette.primary,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  guideInstruction: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  capturedBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  capturedBadgeText: {
    marginLeft: 6,
    fontSize: 12.5,
    fontWeight: '700',
    color: palette.success,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  confirmActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    borderRadius: 12,
    borderColor: '#CBD5E1',
  },
  enrollBtn: {
    flex: 1.3,
    borderRadius: 12,
    backgroundColor: palette.primary,
  },
  shutterContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  shutterButtonOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: palette.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: palette.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 14.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
