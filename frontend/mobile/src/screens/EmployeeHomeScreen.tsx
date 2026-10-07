import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Card,
  Chip,
  Divider,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  checkInAttendance,
  checkOutAttendance,
  getTodayAttendance,
  recordGeofenceExit,
  recordGeofenceReturn,
} from '../api/attendanceApi';
import type { AttendanceSession, TodayAttendance } from '../api/attendanceApi';
import { getAttendanceToken, EmployeeProfile } from '../api/employeeApi';
import {
  computeOfficeLocationAndRadius,
  getOfficeById,
  getOffices,
  verifyLocation,
} from '../api/geofenceApi';
import type { Office, VerifyLocationResult } from '../api/geofenceApi';
import { getUnreadNotificationCount } from '../api/notificationApi';
import { AppButton } from '../components/AppButton';
import { ErrorMessage } from '../components/ErrorMessage';
import { ProfileDrawer } from '../components/ProfileDrawer';
import { FaceCameraModal } from '../components/FaceCameraModal';
import {
  InAppAlertData,
  InAppNotificationBanner,
} from '../components/InAppNotificationBanner';
import { palette } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatClock(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatCountdown(totalSecs: number): string {
  if (totalSecs <= 0) return '00:00';
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Resolves the employee's assigned office from backend data.
 * STRICT RULE: If the employee has no assigned office in profile, returns null.
 * DO NOT FALLBACK TO RANDOM / FIRST OFFICE.
 */
async function resolveEmployeeOffice(
  profile: EmployeeProfile | null,
  officeList: Office[],
): Promise<Office | null> {
  const officeIdOrCode =
    profile?.officeLocationId ||
    profile?.assignedOffice?.id ||
    profile?.assignedOffice?.code;

  if (!officeIdOrCode && !profile?.officeLocationName) {
    return null;
  }

  // 1. Try direct fetch by ID or Code from geofence-service
  if (officeIdOrCode) {
    const directOffice = await getOfficeById(officeIdOrCode);
    if (directOffice) return directOffice;
  }

  // 2. Try match from loaded office list by ID or Code
  if (officeIdOrCode) {
    const idLower = officeIdOrCode.trim().toLowerCase();
    const matched = officeList.find(
      (o) =>
        o.id?.toLowerCase() === idLower ||
        o.code?.toLowerCase() === idLower,
    );
    if (matched) return matched;
  }

  // 3. Try name substring match with officeLocationName
  if (profile?.officeLocationName) {
    const target = profile.officeLocationName.trim().toLowerCase();
    const byName = officeList.find((o) => {
      const oName = o.name?.trim().toLowerCase() || '';
      const oCode = o.code?.trim().toLowerCase() || '';
      return (
        (oName && target.includes(oName)) ||
        (oCode && target.includes(oCode)) ||
        (oName && oName.includes(target))
      );
    });
    if (byName) return byName;
  }

  return null;
}

/**
 * Resolves all authorized offices assigned to the employee.
 * Supports multi-location access: employees can work at Place A as well as Place B.
 */
async function resolveEmployeeOffices(
  profile: EmployeeProfile | null,
  officeList: Office[],
): Promise<Office[]> {
  if (!profile) return [];

  const foundMap = new Map<string, Office>();

  const addOffice = (off: Office | null | undefined) => {
    if (off && off.id && !foundMap.has(off.id)) {
      foundMap.set(off.id, off);
    }
  };

  // 1. Check profile.assignedOffices array
  if (Array.isArray(profile.assignedOffices) && profile.assignedOffices.length > 0) {
    for (const assignment of profile.assignedOffices) {
      if (assignment.isActive === false) continue;
      const targetId = assignment.id?.trim().toLowerCase();
      const targetCode = assignment.code?.trim().toLowerCase();
      const targetName = assignment.name?.trim().toLowerCase();

      const matched = officeList.find((o) => {
        const oId = o.id?.toLowerCase();
        const oCode = o.code?.toLowerCase();
        const oName = o.name?.toLowerCase();
        return (
          (targetId && oId === targetId) ||
          (targetCode && oCode === targetCode) ||
          (targetName && oName === targetName)
        );
      });

      if (matched) {
        addOffice(matched);
      } else if (assignment.id) {
        try {
          const direct = await getOfficeById(assignment.id);
          addOffice(direct);
        } catch {
          // ignore
        }
      }
    }
  }

  // 2. Check profile.officeIds array
  if (Array.isArray(profile.officeIds) && profile.officeIds.length > 0) {
    for (const officeId of profile.officeIds) {
      const idLower = officeId.trim().toLowerCase();
      const matched = officeList.find(
        (o) => o.id?.toLowerCase() === idLower || o.code?.toLowerCase() === idLower,
      );
      if (matched) {
        addOffice(matched);
      } else {
        try {
          const direct = await getOfficeById(officeId);
          addOffice(direct);
        } catch {
          // ignore
        }
      }
    }
  }

  // 3. Fallback / legacy single office fields if no offices found yet
  if (foundMap.size === 0) {
    const single = await resolveEmployeeOffice(profile, officeList);
    if (single) {
      addOffice(single);
    }
  }

  return Array.from(foundMap.values());
}

export type GeofenceUIState =
  | 'INSIDE'
  | 'OUTSIDE'
  | 'CHECKING'
  | 'NO_OFFICE'
  | 'PERMISSION_DENIED'
  | 'GPS_DISABLED'
  | 'API_ERROR';

export default function EmployeeHomeScreen() {
  const navigation = useNavigation<any>();
  const { user, employeeProfile, refreshProfile, logout } = useAuth();

  // Drawer & Alert state
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [inAppAlert, setInAppAlert] = useState<InAppAlertData | null>(null);

  // Attendance state
  const [todayData, setTodayData] = useState<TodayAttendance | null>(null);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [workingSeconds, setWorkingSeconds] = useState<number>(0);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState<number | null>(null);

  // Attendance Verification & Success Modal state
  const [isCheckInModalVisible, setIsCheckInModalVisible] = useState(false);
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [attendancePhoto, setAttendancePhoto] = useState<string | null>(null);
  const [checkInSuccessModal, setCheckInSuccessModal] = useState<{ checkInTime: string } | null>(null);
  const [checkOutSuccessModal, setCheckOutSuccessModal] = useState<{
    checkInTime: string;
    checkOutTime: string;
    duration: string;
  } | null>(null);

  // Geofence & Location state
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [gpsDisabled, setGpsDisabled] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [verifyingGeofence, setVerifyingGeofence] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [geofenceResult, setGeofenceResult] = useState<VerifyLocationResult | null>(null);
  const [assignedOffice, setAssignedOffice] = useState<Office | null>(null);
  const [assignedOfficesList, setAssignedOfficesList] = useState<Office[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);

  // Concurrency & Cache refs
  const isVerifyingRef = useRef(false);
  const officesCacheRef = useRef<Office[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTransitioningRef = useRef(false);
  const activeSessionRef = useRef<AttendanceSession | null>(null);
  const [sessionStatusBanner, setSessionStatusBanner] = useState<{
    type: 'PAUSED' | 'RESUMED';
    message: string;
  } | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Helper for avatar initials
  const getInitials = (): string => {
    if (employeeProfile?.firstName) {
      const first = employeeProfile.firstName[0] || '';
      const last = employeeProfile.lastName?.[0] || '';
      return (first + last).toUpperCase() || 'E';
    }
    if (user?.fullName) {
      const parts = user.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.fullName.slice(0, 2).toUpperCase();
    }
    return 'EM';
  };

  // 1. Fetch unread notification count
  const loadUnreadCount = useCallback(async () => {
    const recipientId = employeeProfile?.id || user?.id;
    if (!recipientId) return;
    try {
      const count = await getUnreadNotificationCount(recipientId);
      setUnreadCount(count);
    } catch {
      // non-fatal
    }
  }, [employeeProfile?.id, user?.id]);

  // 2. Load today's attendance records from server
  const loadAttendance = useCallback(async () => {
    try {
      const empId = employeeProfile?.employeeCode || employeeProfile?.id;
      const data = await getTodayAttendance(empId);
      setTodayData(data);

      const running = data.sessions.find(
        (s) => s.status === 'WORKING' || s.status === 'PAUSED',
      ) ?? null;
      setActiveSession(running);

      if (running) {
        setWorkingSeconds(data.totalWorkingSecondsToday ?? running.totalWorkingSeconds ?? 0);
      } else {
        setWorkingSeconds(data.totalWorkingSecondsToday || 0);
      }

      // Check for automatic checkout in latest session
      const latest = data.sessions[data.sessions.length - 1];
      if (latest && latest.status === 'AUTO_CHECKED_OUT') {
        setInAppAlert({
          id: latest.id,
          type: 'warning',
          title: 'Automatic Check-Out',
          message: `Your attendance was automatically checked out at ${formatTime(latest.checkOutAt)}.`,
          onPress: () => navigation.navigate('AttendanceHistory'),
        });
      }
    } catch {
      // Keep existing state
    } finally {
      setLoadingAttendance(false);
    }
  }, [employeeProfile?.employeeCode, employeeProfile?.id, navigation]);

  // 3. Resolve assigned office & evaluate geofence with GPS
  const checkLocationAndGeofence = useCallback(
    async (arg?: unknown) => {
      const forceRefreshOffices = typeof arg === 'boolean' ? arg : false;
      if (isVerifyingRef.current) return;
      isVerifyingRef.current = true;
      setVerifyingGeofence(true);
      setLocationError(null);
      setPermissionDenied(false);
      setGpsDisabled(false);
      setApiError(false);

      try {
        // Step A: Request foreground location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionDenied(true);
          setLocationError(
            'Location access is required to verify that you are at your assigned office. Please enable location permissions in your device settings.',
          );
          return;
        }

        // Step B: Check if device location services (GPS) are enabled
        const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
        if (!isLocationServicesEnabled) {
          setGpsDisabled(true);
          setLocationError('GPS is disabled on your device. Please turn on Location services in High Accuracy mode.');
          return;
        }

        // Step C: Fetch active offices list if not already cached
        let currentOffices = officesCacheRef.current;
        if (currentOffices.length === 0 || forceRefreshOffices) {
          try {
            currentOffices = await getOffices();
            officesCacheRef.current = currentOffices;
            setOffices(currentOffices);
          } catch {
            // non-fatal, will attempt resolveEmployeeOffice
          }
        }

        // Step D: Strictly resolve employee's assigned offices (multi-location access)
        const assignedList = await resolveEmployeeOffices(employeeProfile, currentOffices);
        setAssignedOfficesList(assignedList);

        // If no office is assigned to employee, stop here and leave geofenceResult null
        if (assignedList.length === 0) {
          setAssignedOffice(null);
          setGeofenceResult(null);
          return;
        }

        // Step E: Get current GPS position with High accuracy
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(pos.coords);

        // Step F: Call geofence-service verify endpoint across assigned offices
        // If employee is physically inside ANY assigned workplace (Place A or Place B), detect that office!
        try {
          const safeAccuracy = Math.min(Math.round(pos.coords.accuracy ?? 10), 30);
          let targetOffice: Office = assignedList[0];
          let finalResult: VerifyLocationResult | null = null;
          let minDistance = Infinity;

          // If session is already active at a specific office, check that office first
          const currentSession = activeSessionRef.current;
          const sessionOfficeId = currentSession?.officeId?.toLowerCase();
          const priorityList = sessionOfficeId
            ? [
                ...assignedList.filter(
                  (o) =>
                    o.id?.toLowerCase() === sessionOfficeId ||
                    o.code?.toLowerCase() === sessionOfficeId,
                ),
                ...assignedList.filter(
                  (o) =>
                    o.id?.toLowerCase() !== sessionOfficeId &&
                    o.code?.toLowerCase() !== sessionOfficeId,
                ),
              ]
            : assignedList;

          for (const off of priorityList) {
            try {
              const res = await verifyLocation({
                officeId: off.code || off.id,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracyMeters: safeAccuracy,
                altitudeMeters: pos.coords.altitude ?? undefined,
              });

              if (res.isInside) {
                targetOffice = off;
                finalResult = res;
                break;
              }

              const dist =
                typeof res.distanceToBoundaryMeters === 'number'
                  ? res.distanceToBoundaryMeters
                  : Infinity;
              if (!finalResult || dist < minDistance) {
                minDistance = dist;
                targetOffice = off;
                finalResult = res;
              }
            } catch (officeErr) {
              console.warn(`Could not verify geofence for office ${off.code || off.id}:`, officeErr);
            }
          }

          if (!finalResult) {
            finalResult = await verifyLocation({
              officeId: targetOffice.code || targetOffice.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyMeters: safeAccuracy,
              altitudeMeters: pos.coords.altitude ?? undefined,
            });
          }

          setAssignedOffice(targetOffice);
          setGeofenceResult(finalResult);
          const result = finalResult;
          setApiError(false);

          // Automated Geofence Transition:
          // Outside boundary -> Auto-pause WORKING session
          // Return inside boundary -> Auto-resume PAUSED session
          const activeSessionForTransition = activeSessionRef.current;
          if (activeSessionForTransition && !isTransitioningRef.current) {
            const empId = employeeProfile?.employeeCode || employeeProfile?.id;
            const officeTarget = targetOffice.code || targetOffice.id;

            if (activeSessionForTransition.status === 'WORKING' && !result.isInside) {
              isTransitioningRef.current = true;
              try {
                const updated = await recordGeofenceExit(
                  {
                    officeId: officeTarget,
                    clientEventId: generateUUID(),
                    location: {
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                      accuracyMeters: safeAccuracy,
                      timestamp: new Date().toISOString(),
                    },
                  },
                  empId,
                );
                setActiveSession(updated);
                if (typeof updated.totalWorkingSeconds === 'number') {
                  setWorkingSeconds(updated.totalWorkingSeconds);
                }
                setSessionStatusBanner({
                  type: 'PAUSED',
                  message: 'Outside office boundary: Working timer paused automatically.',
                });
              } catch (exitErr) {
                console.warn('Auto geofence-exit error:', exitErr);
              } finally {
                isTransitioningRef.current = false;
              }
            } else if (activeSessionForTransition.status === 'PAUSED' && result.isInside) {
              isTransitioningRef.current = true;
              try {
                const updated = await recordGeofenceReturn(
                  {
                    officeId: officeTarget,
                    clientEventId: generateUUID(),
                    location: {
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                      accuracyMeters: safeAccuracy,
                      timestamp: new Date().toISOString(),
                    },
                  },
                  empId,
                );
                setActiveSession(updated);
                if (typeof updated.totalWorkingSeconds === 'number') {
                  setWorkingSeconds(updated.totalWorkingSeconds);
                }
                setSessionStatusBanner({
                  type: 'RESUMED',
                  message: 'Returned inside office boundary: Working timer resumed.',
                });
              } catch (returnErr) {
                console.warn('Auto geofence-return error:', returnErr);
              } finally {
                isTransitioningRef.current = false;
              }
            }
          }
        } catch (geoErr) {
          setApiError(true);
          setGeofenceResult(null);
          setLocationError(getErrorMessage(geoErr, 'Could not verify location with server.'));
        }
      } catch (err: unknown) {
        setLocationError(getErrorMessage(err, 'Failed to acquire GPS location.'));
        setApiError(true);
      } finally {
        isVerifyingRef.current = false;
        setVerifyingGeofence(false);
      }
    },
    [employeeProfile],
  );

  // Refresh all state (attendance + geofence + profile + unread notifications)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } catch {
      // non-fatal
    }
    try {
      await Promise.all([loadAttendance(), checkLocationAndGeofence(true), loadUnreadCount()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile, loadAttendance, checkLocationAndGeofence, loadUnreadCount]);

  // Initial load - runs strictly once on mount
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        await refreshProfile();
      } catch {
        // non-fatal
      }
      if (isMounted) {
        loadAttendance();
        checkLocationAndGeofence();
        loadUnreadCount();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-verify strictly when employee office location identity changes
  const officeKey = `${employeeProfile?.officeLocationId || ''}_${employeeProfile?.officeLocationName || ''}_${employeeProfile?.assignedOffice?.id || ''}`;
  const lastOfficeKeyRef = useRef(officeKey);

  useEffect(() => {
    if (officeKey && officeKey !== lastOfficeKeyRef.current) {
      lastOfficeKeyRef.current = officeKey;
      void checkLocationAndGeofence(true);
    }
  }, [officeKey, checkLocationAndGeofence]);

  // Live timer effect for active working session
  useEffect(() => {
    if (activeSession && activeSession.status === 'WORKING') {
      timerRef.current = setInterval(() => {
        setWorkingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  // Live countdown ticker for PAUSED session grace period
  useEffect(() => {
    if (activeSession && activeSession.status === 'PAUSED' && activeSession.currentGraceDeadline) {
      const calcRemaining = () => {
        const deadline = new Date(activeSession.currentGraceDeadline!).getTime();
        const diff = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
        return diff;
      };

      setGraceSecondsLeft(calcRemaining());
      const graceInterval = setInterval(() => {
        const rem = calcRemaining();
        setGraceSecondsLeft(rem);
        if (rem <= 0) {
          // Grace period elapsed - trigger reload to synchronize auto-checkout
          void loadAttendance();
        }
      }, 1000);

      return () => clearInterval(graceInterval);
    } else {
      setGraceSecondsLeft(null);
    }
  }, [activeSession?.status, activeSession?.currentGraceDeadline, loadAttendance]);

  // Continuous Geofence Monitoring for Active (WORKING or PAUSED) session
  useEffect(() => {
    if (!activeSession || (activeSession.status !== 'WORKING' && activeSession.status !== 'PAUSED')) {
      return;
    }

    // Run periodic GPS check every 10 seconds while session is active
    const interval = setInterval(() => {
      void checkLocationAndGeofence();
    }, 10000);

    // Also watch GPS position changes for immediate reaction
    let locationSub: Location.LocationSubscription | null = null;
    void (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 5,
              timeInterval: 8000,
            },
            () => {
              void checkLocationAndGeofence();
            },
          );
        }
      } catch {
        // Fallback to interval
      }
    })();

    return () => {
      clearInterval(interval);
      if (locationSub) {
        locationSub.remove();
      }
    };
  }, [activeSession?.status, checkLocationAndGeofence]);

  // Open Camera for Attendance Verification
  const handleOpenAttendanceCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Access Required',
          'Camera access is required for attendance verification. Please enable camera in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAttendancePhoto(dataUri);
      }
    } catch (err: unknown) {
      Alert.alert('Camera Error', getErrorMessage(err, 'Failed to launch camera.'));
    }
  };

  // Step 1: Initiate Check-In (Validate Geofence & Open Biometric Face Modal)
  const handleInitiateCheckIn = () => {
    if (!assignedOffice) {
      Alert.alert(
        'No Office Assigned',
        'No office has been assigned to your account yet. Please contact your administrator.',
      );
      return;
    }

    if (!geofenceResult?.isInside) {
      const distance = geofenceResult?.distanceToBoundaryMeters
        ? ` (${Math.round(geofenceResult.distanceToBoundaryMeters)}m away)`
        : '';
      Alert.alert(
        'Outside Assigned Office',
        `You are outside your assigned office${distance}.\nPlease reach the office premises to mark attendance.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Refresh Location', onPress: checkLocationAndGeofence },
        ],
      );
      return;
    }

    if (!location) {
      Alert.alert('GPS Required', 'Please refresh your location to verify geofence before check-in.');
      return;
    }

    // Launch live biometric face recognition modal
    setFaceModalMode('checkIn');
    setFaceModalVisible(true);
  };

  // Step 2: Confirm Check-In with Face Verification Token
  const handleConfirmCheckIn = async (verificationToken?: string, photoUri?: string) => {
    setActionLoading(true);
    setFeedback(null);

    try {
      const officeId =
        assignedOffice?.code ||
        employeeProfile?.officeLocationId ||
        employeeProfile?.assignedOffice?.code ||
        assignedOffice?.id ||
        geofenceResult?.officeId ||
        'OFFICE-001';

      // Fallback token if not passed directly from Face AI verification
      let finalVerificationToken = verificationToken;
      if (!finalVerificationToken && attendancePhoto) {
        try {
          const tokenRes = await getAttendanceToken(attendancePhoto);
          finalVerificationToken = tokenRes.token;
        } catch {
          // Handled in attendanceApi
        }
      }

      const safeAccuracy = Math.min(Math.round(location?.accuracy ?? 10), 30);
      const session = await checkInAttendance(
        {
          officeId,
          clientEventId: generateUUID(),
          faceVerificationToken: finalVerificationToken,
          location: {
            latitude: location!.latitude,
            longitude: location!.longitude,
            accuracyMeters: safeAccuracy,
            timestamp: new Date().toISOString(),
          },
        },
        employeeProfile?.employeeCode || employeeProfile?.id,
      );

      setActiveSession(session);
      const checkInTime = formatTime(session.checkInAt);
      setIsCheckInModalVisible(false);
      setAttendancePhoto(null);

      // Show Check-in Successful modal
      setCheckInSuccessModal({ checkInTime });

      setFeedback({ message: 'Checked in successfully! Have a productive day.', type: 'success' });
      await loadAttendance();
      await loadUnreadCount();
    } catch (err: unknown) {
      setFeedback({
        message: getErrorMessage(err, 'Check-in failed. Please verify GPS and try again.'),
        type: 'error',
      });
      Alert.alert('Check-In Failed', getErrorMessage(err, 'Unable to mark check-in.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Step 3: Initiate Check-Out with Face Verification
  const handleInitiateCheckOut = () => {
    Alert.alert(
      "Today's Attendance Check-Out",
      `Check-in: ${formatTime(activeSession?.checkInAt)}\nWorking Duration: ${formatClock(workingSeconds)}\n\nFace biometric verification is required to complete check-out. Proceed to camera?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify Face & Check Out',
          onPress: () => {
            setFaceModalMode('checkOut');
            setFaceModalVisible(true);
          },
        },
      ],
    );
  };

  // Step 4: Confirm Check-Out (executed after face verification)
  const handleCheckOut = async (verificationToken?: string) => {
    if (!location) {
      await checkLocationAndGeofence();
    }

    setActionLoading(true);
    setFeedback(null);

    try {
      const checkInFormatted = formatTime(activeSession?.checkInAt);
      const officeId =
        activeSession?.officeId ||
        assignedOffice?.code ||
        employeeProfile?.officeLocationId ||
        employeeProfile?.assignedOffice?.code ||
        assignedOffice?.id ||
        'OFFICE-001';

      const safeAccuracy = Math.min(Math.round(location?.accuracy ?? 10), 30);
      await checkOutAttendance(
        {
          officeId,
          clientEventId: generateUUID(),
          location: {
            latitude: location?.latitude ?? 0,
            longitude: location?.longitude ?? 0,
            accuracyMeters: safeAccuracy,
            timestamp: new Date().toISOString(),
          },
        },
        employeeProfile?.employeeCode || employeeProfile?.id,
      );

      const checkOutTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const durationFormatted = formatClock(workingSeconds);

      setActiveSession(null);
      setCheckOutSuccessModal({
        checkInTime: checkInFormatted,
        checkOutTime,
        duration: durationFormatted,
      });

      setFeedback({ message: 'Checked out successfully. Time logged for today.', type: 'success' });
      await loadAttendance();
      await loadUnreadCount();
    } catch (err: unknown) {
      setFeedback({
        message: getErrorMessage(err, 'Check-out failed. Please try again.'),
        type: 'error',
      });
      Alert.alert('Check-Out Failed', getErrorMessage(err, 'Unable to record check-out.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Determine current UI geofence state (States 1 to 6)
  const isWorking = activeSession?.status === 'WORKING';
  const isPaused = activeSession?.status === 'PAUSED';
  const hasAssignedOffice = Boolean(
    assignedOffice ||
      employeeProfile?.officeLocationId ||
      employeeProfile?.assignedOffice?.id,
  );

  let geofenceUIState: GeofenceUIState = 'NO_OFFICE';
  if (!hasAssignedOffice) {
    geofenceUIState = 'NO_OFFICE';
  } else if (verifyingGeofence) {
    geofenceUIState = 'CHECKING';
  } else if (permissionDenied) {
    geofenceUIState = 'PERMISSION_DENIED';
  } else if (gpsDisabled) {
    geofenceUIState = 'GPS_DISABLED';
  } else if (apiError) {
    geofenceUIState = 'API_ERROR';
  } else if (geofenceResult?.isInside) {
    geofenceUIState = 'INSIDE';
  } else {
    geofenceUIState = 'OUTSIDE';
  }

  const isInside = geofenceUIState === 'INSIDE';

  // Compute office location coordinates & geofence radius
  const officeMetrics = assignedOffice ? computeOfficeLocationAndRadius(assignedOffice) : null;

  const latestSession = todayData?.sessions[todayData.sessions.length - 1];
  const isAutoCheckedOut = latestSession?.status === 'AUTO_CHECKED_OUT';

  const employeeName =
    employeeProfile?.firstName ||
    user?.fullName?.split(' ')[0] ||
    'Employee';

  const officeDisplayName =
    assignedOffice?.name ||
    employeeProfile?.officeLocationName ||
    employeeProfile?.assignedOffice?.name ||
    'Assigned Office';

  const officeDisplayCode =
    assignedOffice?.code ||
    employeeProfile?.officeLocationId ||
    employeeProfile?.assignedOffice?.code ||
    '—';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Floating In-App Alert Toast */}
      <InAppNotificationBanner
        alert={inAppAlert}
        onDismiss={() => setInAppAlert(null)}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[palette.primary]}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              Hello, {employeeName} 👋
            </Text>
            <Text style={styles.subGreeting}>
              {employeeProfile?.jobTitle || 'Intern Trainee'}
              {employeeProfile?.department ? ` • ${employeeProfile.department.name}` : ''}
            </Text>
          </View>

          {/* Top-Right Profile / Drawer Trigger */}
          <TouchableOpacity
            style={styles.profileBtn}
            activeOpacity={0.8}
            onPress={() => setIsDrawerVisible(true)}
            accessibilityLabel="Open user menu"
          >
            {employeeProfile?.profilePhotoUrl ? (
              <Avatar.Image
                size={44}
                source={{ uri: employeeProfile.profilePhotoUrl }}
                style={styles.avatar}
              />
            ) : (
              <Avatar.Text
                size={44}
                label={getInitials()}
                style={styles.avatar}
                labelStyle={styles.avatarLabel}
              />
            )}
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {feedback && (
          <ErrorMessage
            message={feedback.message}
            variant={feedback.type === 'success' ? 'info' : 'error'}
          />
        )}

        {/* SECTION 6 — LOCATION PERMISSION & GPS BANNER */}
        {permissionDenied && (
          <Card style={styles.permissionCard} mode="outlined">
            <Card.Content style={styles.permissionContent}>
              <View style={styles.permissionIconWrap}>
                <MaterialCommunityIcons name="map-marker-alert-outline" size={24} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>Location Access Required</Text>
                <Text style={styles.permissionText}>
                  Location access is required to verify that you are at your assigned office. Please enable location permissions in your device settings.
                </Text>
                <View style={styles.permissionActions}>
                  <TouchableOpacity
                    style={styles.settingsBtn}
                    onPress={() => void Linking.openSettings()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.settingsBtnText}>Open Settings</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.recheckBtn}
                    onPress={checkLocationAndGeofence}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.recheckBtnText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {gpsDisabled && (
          <Card style={styles.permissionCard} mode="outlined">
            <Card.Content style={styles.permissionContent}>
              <View style={styles.permissionIconWrap}>
                <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>GPS Disabled</Text>
                <Text style={styles.permissionText}>
                  GPS is disabled on your device. Please turn on location services in High Accuracy mode to verify office presence.
                </Text>
                <TouchableOpacity
                  style={[styles.settingsBtn, { marginTop: 8 }]}
                  onPress={checkLocationAndGeofence}
                  activeOpacity={0.8}
                >
                  <Text style={styles.settingsBtnText}>Re-check GPS</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* SECTION 5 — DEDICATED ASSIGNED OFFICE CARD */}
        <Card style={styles.officeCard} mode="outlined">
          <Card.Content style={styles.officeCardContent}>
            <View style={styles.officeCardHeader}>
              <View style={styles.officeTitleRow}>
                <MaterialCommunityIcons name="office-building" size={20} color={palette.primary} />
                <Text style={styles.officeSectionTitle}>YOUR ASSIGNED OFFICE</Text>
              </View>
              {hasAssignedOffice ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {assignedOfficesList.length > 1 && (
                    <View style={styles.multiOfficeBadge}>
                      <Text style={styles.multiOfficeBadgeText}>
                        {assignedOfficesList.length} Workplaces
                      </Text>
                    </View>
                  )}
                  <View style={styles.activeBadge}>
                    <View style={styles.activeBadgeDot} />
                    <Text style={styles.activeBadgeText}>
                      {assignedOffice?.isActive !== false ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.unassignedBadge}>
                  <Text style={styles.unassignedBadgeText}>Not Assigned</Text>
                </View>
              )}
            </View>

            <Divider style={styles.officeDivider} />

            {hasAssignedOffice ? (
              <View>
                {/* Multi-Location Switcher Chips if employee has more than 1 assigned office */}
                {assignedOfficesList.length > 1 && (
                  <View style={styles.multiOfficeBox}>
                    <Text style={styles.multiOfficeBoxLabel}>
                      Multi-Location Access (Tap workplace to inspect):
                    </Text>
                    <View style={styles.multiOfficeChipRow}>
                      {assignedOfficesList.map((off) => {
                        const isCurrent =
                          (assignedOffice?.id && off.id && assignedOffice.id === off.id) ||
                          (assignedOffice?.code &&
                            off.code &&
                            assignedOffice.code.toLowerCase() === off.code.toLowerCase());
                        const isInsideThis = isCurrent && geofenceResult?.isInside;
                        return (
                          <TouchableOpacity
                            key={off.id || off.code}
                            style={[
                              styles.multiOfficeChip,
                              isCurrent && styles.multiOfficeChipSelected,
                              isInsideThis && styles.multiOfficeChipInside,
                            ]}
                            onPress={() => {
                              setAssignedOffice(off);
                              if (location) {
                                void verifyLocation({
                                  officeId: off.code || off.id,
                                  latitude: location.latitude,
                                  longitude: location.longitude,
                                  accuracyMeters: Math.min(Math.round(location.accuracy ?? 10), 30),
                                  altitudeMeters: location.altitude ?? undefined,
                                })
                                  .then((res) => setGeofenceResult(res))
                                  .catch((e) => console.warn('Office switch verify error:', e));
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons
                              name={isInsideThis ? 'check-circle' : isCurrent ? 'office-building-marker' : 'office-building'}
                              size={14}
                              color={isInsideThis ? '#15803D' : isCurrent ? palette.primary : palette.muted}
                            />
                            <Text
                              style={[
                                styles.multiOfficeChipText,
                                isCurrent && styles.multiOfficeChipTextSelected,
                                isInsideThis && styles.multiOfficeChipTextInside,
                              ]}
                            >
                              {off.name || off.code}
                            </Text>
                            {isInsideThis && <View style={styles.chipInsideDot} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                <View style={styles.officeMainRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.officeNameText}>{officeDisplayName}</Text>
                    <Text style={styles.officeCodeText}>Code: {officeDisplayCode}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshOfficeBtn}
                    onPress={checkLocationAndGeofence}
                    disabled={verifyingGeofence}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="crosshairs-gps"
                      size={15}
                      color={palette.primary}
                    />
                    <Text style={styles.refreshOfficeText}>
                      {verifyingGeofence ? 'Checking...' : 'Refresh Location'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Office Info Grid */}
                <View style={styles.officeDetailsGrid}>
                  <View style={styles.officeDetailItem}>
                    <Text style={styles.officeDetailLabel}>Geofence Radius</Text>
                    <Text style={styles.officeDetailValue}>
                      {officeMetrics?.radiusMeters
                        ? `${officeMetrics.radiusMeters} metres`
                        : 'Configured Perimeter'}
                    </Text>
                  </View>

                  <View style={styles.officeDetailItem}>
                    <Text style={styles.officeDetailLabel}>Office Coordinates</Text>
                    <Text style={styles.officeDetailValue}>
                      {officeMetrics
                        ? `${officeMetrics.latitude.toFixed(5)}, ${officeMetrics.longitude.toFixed(5)}`
                        : 'Polygon Defined'}
                    </Text>
                  </View>
                </View>

                {assignedOffice?.city && (
                  <View style={styles.officeLocationRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={palette.muted} />
                    <Text style={styles.officeLocationText}>
                      {assignedOffice.city}
                      {assignedOffice.country ? `, ${assignedOffice.country}` : ''}
                      {assignedOffice.address ? ` • ${assignedOffice.address}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* No Office Assigned Empty State */
              <View style={styles.noOfficeBox}>
                <View style={styles.noOfficeIconWrap}>
                  <MaterialCommunityIcons name="office-building-marker-outline" size={32} color="#D97706" />
                </View>
                <Text style={styles.noOfficeTitle}>No Office Assigned</Text>
                <Text style={styles.noOfficeDesc}>
                  No office has been assigned to your account yet. Please contact your administrator.
                </Text>
                <TouchableOpacity
                  style={styles.noOfficeRefreshBtn}
                  onPress={handleRefresh}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color={palette.primary} />
                  <Text style={styles.noOfficeRefreshText}>Check for Assignment</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* SECTION 7 — REAL-TIME GEOFENCE STATUS CARD */}
        <Card
          style={[
            styles.geofenceCard,
            geofenceUIState === 'INSIDE'
              ? styles.geofenceCardInside
              : geofenceUIState === 'OUTSIDE'
              ? styles.geofenceCardOutside
              : styles.geofenceCardNeutral,
          ]}
          mode="outlined"
        >
          <Card.Content style={styles.geofenceContent}>
            <View style={styles.rowBetween}>
              <View style={styles.statusIndicatorRow}>
                {geofenceUIState === 'CHECKING' ? (
                  <ActivityIndicator size={12} color={palette.primary} style={{ marginRight: 8 }} />
                ) : (
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          geofenceUIState === 'INSIDE'
                            ? palette.success
                            : geofenceUIState === 'OUTSIDE'
                            ? '#F59E0B'
                            : geofenceUIState === 'API_ERROR' || geofenceUIState === 'PERMISSION_DENIED'
                            ? palette.error
                            : '#94A3B8',
                      },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.geofenceTitle,
                    {
                      color:
                        geofenceUIState === 'INSIDE'
                          ? '#166534'
                          : geofenceUIState === 'OUTSIDE'
                          ? '#92400E'
                          : geofenceUIState === 'API_ERROR' || geofenceUIState === 'PERMISSION_DENIED'
                          ? palette.error
                          : palette.ink,
                    },
                  ]}
                >
                  {geofenceUIState === 'INSIDE' && 'Inside Assigned Office'}
                  {geofenceUIState === 'OUTSIDE' && "Outside Office"}
                  {geofenceUIState === 'CHECKING' && 'Verifying Location...'}
                  {geofenceUIState === 'NO_OFFICE' && 'No Office Assigned'}
                  {geofenceUIState === 'PERMISSION_DENIED' && 'Location Permission Denied'}
                  {geofenceUIState === 'GPS_DISABLED' && 'GPS Unavailable'}
                  {geofenceUIState === 'API_ERROR' && 'Verification Server Error'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={checkLocationAndGeofence}
                disabled={verifyingGeofence}
                style={styles.refreshBtn}
                activeOpacity={0.7}
              >
                {verifyingGeofence ? (
                  <View style={styles.verifyingRow}>
                    <ActivityIndicator size={14} color={palette.primary} />
                    <Text style={styles.verifyingText}>Verifying...</Text>
                  </View>
                ) : (
                  <View style={styles.refreshRow}>
                    <MaterialCommunityIcons name="crosshairs-gps" size={15} color={palette.primary} />
                    <Text style={styles.refreshText}>Refresh GPS</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Divider style={styles.geoDivider} />

            {/* Current GPS Coordinates */}
            {location && (
              <View style={styles.coordsRow}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color={palette.muted} />
                <Text style={styles.coordsText}>
                  Your GPS: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} (±
                  {Math.round(location.accuracy ?? 0)}m)
                </Text>
              </View>
            )}

            {/* State Explanatory Banners */}
            {geofenceUIState === 'INSIDE' && (
              <View style={styles.insideNotice}>
                <View style={styles.noticeIconWrap}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={palette.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insideText}>
                    You are inside your assigned office ({officeDisplayName}).
                  </Text>
                  <Text style={styles.insideSubtext}>
                    Location verified. Ready for attendance check-in.
                  </Text>
                </View>
              </View>
            )}

            {geofenceUIState === 'OUTSIDE' && (
              <View style={styles.outsideNotice}>
                <View style={styles.noticeIconWrap}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.outsideText}>
                    You are outside your assigned office ({officeDisplayName}).
                  </Text>
                  {Boolean(geofenceResult?.distanceToBoundaryMeters) && (
                    <Text style={styles.outsideDistanceText}>
                      Distance to boundary: ~{Math.round(geofenceResult!.distanceToBoundaryMeters)}m away
                    </Text>
                  )}
                  <Text style={styles.outsideSubtext}>
                    Attendance check-in is restricted to your assigned office geofence.
                  </Text>
                </View>
              </View>
            )}

            {geofenceUIState === 'CHECKING' && (
              <View style={styles.checkingNotice}>
                <ActivityIndicator size={16} color={palette.primary} style={{ marginTop: 1 }} />
                <Text style={styles.checkingText}>
                  Acquiring GPS fix and verifying boundary with geofence service...
                </Text>
              </View>
            )}

            {geofenceUIState === 'NO_OFFICE' && (
              <View style={styles.noOfficeNotice}>
                <MaterialCommunityIcons name="information-outline" size={16} color={palette.muted} />
                <Text style={styles.noOfficeNoticeText}>
                  No office has been assigned to your account. Check-in is disabled until an office is allocated by an administrator.
                </Text>
              </View>
            )}

            {geofenceUIState === 'API_ERROR' && (
              <View style={styles.errorNotice}>
                <MaterialCommunityIcons name="cloud-alert" size={16} color={palette.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorNoticeText}>
                    Unable to verify location with the server.
                  </Text>
                  <TouchableOpacity onPress={checkLocationAndGeofence} style={{ marginTop: 4 }}>
                    <Text style={styles.errorRetryText}>Tap here to retry verification</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* SECTION 8 — WORKING DURATION & DYNAMIC ACTION BUTTON CARD */}
        <Card style={styles.trackerCard} mode="elevated">
          <Card.Content style={styles.trackerContent}>
            <Text style={styles.trackerHeading}>Today's Working Duration</Text>

            {/* LIVE TICKING CLOCK */}
            <View style={styles.clockContainer}>
              <Text style={styles.clockText}>{formatClock(workingSeconds)}</Text>
              {isWorking ? (
                <View style={styles.liveIndicator}>
                  <View style={styles.pulsingDot} />
                  <Text style={styles.liveText}>RECORDING LIVE</Text>
                </View>
              ) : isPaused ? (
                <View style={[styles.autoCheckOutBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                  <MaterialCommunityIcons name="pause-circle-outline" size={13} color="#D97706" />
                  <Text style={[styles.autoCheckOutText, { color: '#B45309' }]}>PAUSED (OUTSIDE GEOFENCE)</Text>
                </View>
              ) : isAutoCheckedOut ? (
                <View style={styles.autoCheckOutBadge}>
                  <MaterialCommunityIcons name="clock-alert-outline" size={13} color="#D97706" />
                  <Text style={styles.autoCheckOutText}>AUTOMATICALLY CHECKED OUT</Text>
                </View>
              ) : null}
            </View>

            {/* SPECIAL CONDITION WORKING HOURS BREAKDOWN */}
            {Boolean(
              todayData?.totalSpecialConditionSecondsToday &&
                todayData.totalSpecialConditionSecondsToday > 0,
            ) && (
              <View style={styles.specialConditionCard}>
                <View style={styles.specialConditionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons
                      name="star-circle"
                      size={18}
                      color="#7C3AED"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.specialConditionTitle}>
                      Special Condition Working Hours
                    </Text>
                  </View>
                  <View style={styles.specialConditionBadge}>
                    <Text style={styles.specialConditionBadgeText}>HR APPROVED</Text>
                  </View>
                </View>

                <View style={styles.specialConditionRow}>
                  <View style={styles.specialConditionStat}>
                    <Text style={styles.specialConditionStatLabel}>Regular</Text>
                    <Text style={styles.specialConditionStatVal}>
                      {formatClock(
                        todayData?.totalRegularWorkingSecondsToday ??
                          Math.max(
                            0,
                            workingSeconds -
                              (todayData?.totalSpecialConditionSecondsToday || 0),
                          ),
                      )}
                    </Text>
                  </View>

                  <View style={styles.specialConditionDivider} />

                  <View style={styles.specialConditionStat}>
                    <Text style={styles.specialConditionStatLabel}>Special Credit</Text>
                    <Text
                      style={[
                        styles.specialConditionStatVal,
                        { color: '#7C3AED' },
                      ]}
                    >
                      +{formatClock(todayData?.totalSpecialConditionSecondsToday || 0)}
                    </Text>
                  </View>

                  <View style={styles.specialConditionDivider} />

                  <View style={styles.specialConditionStat}>
                    <Text style={styles.specialConditionStatLabel}>Total Hours</Text>
                    <Text
                      style={[
                        styles.specialConditionStatVal,
                        { color: palette.primary, fontWeight: '800' },
                      ]}
                    >
                      {formatClock(workingSeconds)}
                    </Text>
                  </View>
                </View>

                {Boolean(
                  todayData?.sessions?.find((s) => s.specialConditionReason)
                    ?.specialConditionReason,
                ) && (
                  <Text style={styles.specialConditionReasonText}>
                    Note: "
                    {
                      todayData?.sessions?.find((s) => s.specialConditionReason)
                        ?.specialConditionReason
                    }
                    "
                  </Text>
                )}
              </View>
            )}

            {/* STATUS BANNER NOTIFICATION */}
            {sessionStatusBanner && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: sessionStatusBanner.type === 'PAUSED' ? '#FEF3C7' : '#DCFCE7',
                  borderWidth: 1,
                  borderColor: sessionStatusBanner.type === 'PAUSED' ? '#F59E0B' : '#22C55E',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 12,
                }}
              >
                <MaterialCommunityIcons
                  name={sessionStatusBanner.type === 'PAUSED' ? 'pause-circle' : 'play-circle'}
                  size={20}
                  color={sessionStatusBanner.type === 'PAUSED' ? '#D97706' : '#16A34A'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: '600',
                    color: sessionStatusBanner.type === 'PAUSED' ? '#92400E' : '#166534',
                  }}
                >
                  {sessionStatusBanner.message}
                </Text>
                <TouchableOpacity onPress={() => setSessionStatusBanner(null)}>
                  <MaterialCommunityIcons name="close" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}

            {/* DYNAMIC ACTION BUTTON WITH 6 STATES */}
            <View style={styles.actionContainer}>
              {isWorking ? (
                // Checked In -> Check Out Action
                <View>
                  <AppButton
                    onPress={handleInitiateCheckOut}
                    loading={actionLoading}
                    disabled={actionLoading}
                    style={[styles.actionBtn, { backgroundColor: palette.error }]}
                    textColor="#FFFFFF"
                  >
                    Check Out Now
                  </AppButton>
                  <Text style={styles.actionSubtitle}>
                    Session active since {formatTime(activeSession?.checkInAt)}
                  </Text>
                </View>
              ) : isPaused ? (
                // Paused Session -> Live Grace Period Countdown Card & Actions
                <View>
                  <View style={styles.graceCard}>
                    <View style={styles.graceHeader}>
                      <MaterialCommunityIcons name="timer-sand" size={24} color="#D97706" />
                      <Text style={styles.graceTitle}>Grace Period Active (Timer Paused)</Text>
                    </View>

                    <View style={styles.graceTimerWrap}>
                      <Text
                        style={[
                          styles.graceTimerDigits,
                          graceSecondsLeft !== null && graceSecondsLeft < 180 ? styles.graceTimerDigitsUrgent : null,
                        ]}
                      >
                        {graceSecondsLeft !== null ? formatCountdown(graceSecondsLeft) : '—:—'}
                      </Text>
                      <Text style={styles.graceTimerLabel}>
                        {graceSecondsLeft !== null && graceSecondsLeft <= 0
                          ? 'GRACE PERIOD EXPIRED — AUTO-CHECKOUT IN PROGRESS'
                          : 'GRACE TIME REMAINING TO RETURN TO OFFICE'}
                      </Text>
                    </View>

                    <Text style={styles.graceDesc}>
                      You are currently outside your assigned office ({officeDisplayName}). Working hours are paused. Return inside the office boundary to automatically resume tracking.
                    </Text>

                    {Boolean(activeSession?.currentGraceDeadline) && (
                      <View style={styles.graceDeadlineRow}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={16} color="#B45309" />
                        <Text style={styles.graceDeadlineText}>
                          Auto-checkout deadline: {formatTime(activeSession?.currentGraceDeadline)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.graceBtnRow}>
                      <TouchableOpacity
                        style={styles.graceResumeBtn}
                        onPress={() => void checkLocationAndGeofence()}
                        disabled={verifyingGeofence}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name={verifyingGeofence ? 'progress-clock' : 'crosshairs-gps'}
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.graceResumeBtnText}>
                          {verifyingGeofence ? 'Verifying...' : 'Check Location'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.graceCheckoutBtn}
                        onPress={handleInitiateCheckOut}
                        disabled={actionLoading}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="logout" size={18} color="#FFFFFF" />
                        <Text style={styles.graceCheckoutBtnText}>Check Out Now</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.actionSubtitle}>
                    Session started at {formatTime(activeSession?.checkInAt)} • Working Timer Paused
                  </Text>
                </View>
              ) : (
                // Not Checked In -> 6 Geofence UI States
                <View>
                  {/* STATE 1: INSIDE OFFICE */}
                  {geofenceUIState === 'INSIDE' && (
                    <View>
                      <AppButton
                        onPress={handleInitiateCheckIn}
                        loading={actionLoading}
                        disabled={actionLoading}
                        style={[styles.actionBtn, { backgroundColor: palette.success }]}
                        textColor="#FFFFFF"
                        icon="check-circle"
                      >
                        CHECK IN
                      </AppButton>
                      <Text style={[styles.actionSubtitle, { color: '#166534' }]}>
                        You are inside your assigned office. Ready to check in.
                      </Text>
                    </View>
                  )}

                  {/* STATE 2: OUTSIDE OFFICE */}
                  {geofenceUIState === 'OUTSIDE' && (
                    <View>
                      <AppButton
                        onPress={handleInitiateCheckIn}
                        disabled
                        style={[styles.actionBtn, { backgroundColor: '#94A3B8' }]}
                        textColor="#FFFFFF"
                        icon="map-marker-off"
                      >
                        CANNOT CHECK IN — OUTSIDE OFFICE
                      </AppButton>
                      <Text style={styles.actionSubtitle}>
                        You must be inside your assigned office to check in
                      </Text>
                    </View>
                  )}

                  {/* STATE 3: LOCATION CHECKING */}
                  {geofenceUIState === 'CHECKING' && (
                    <View>
                      <AppButton
                        disabled
                        loading
                        style={[styles.actionBtn, { backgroundColor: '#64748B' }]}
                        textColor="#FFFFFF"
                      >
                        VERIFYING LOCATION...
                      </AppButton>
                      <Text style={styles.actionSubtitle}>
                        Acquiring GPS fix and checking boundary...
                      </Text>
                    </View>
                  )}

                  {/* STATE 4: NO OFFICE ASSIGNED */}
                  {geofenceUIState === 'NO_OFFICE' && (
                    <View>
                      <AppButton
                        disabled
                        style={[styles.actionBtn, { backgroundColor: '#94A3B8' }]}
                        textColor="#FFFFFF"
                        icon="office-building-remove"
                      >
                        NO OFFICE ASSIGNED
                      </AppButton>
                      <Text style={styles.actionSubtitle}>
                        Contact your HR admin to assign an office location
                      </Text>
                    </View>
                  )}

                  {/* STATE 5: GPS UNAVAILABLE / PERMISSION DENIED */}
                  {(geofenceUIState === 'PERMISSION_DENIED' || geofenceUIState === 'GPS_DISABLED') && (
                    <View>
                      <AppButton
                        onPress={() => {
                          if (permissionDenied) {
                            void Linking.openSettings();
                          } else {
                            void checkLocationAndGeofence();
                          }
                        }}
                        style={[styles.actionBtn, { backgroundColor: '#D97706' }]}
                        textColor="#FFFFFF"
                        icon="crosshairs-gps"
                      >
                        ENABLE LOCATION TO CHECK IN
                      </AppButton>
                      <Text style={styles.actionSubtitle}>
                        {permissionDenied
                          ? 'Tap to open settings and grant location permissions'
                          : 'Tap to refresh GPS location'}
                      </Text>
                    </View>
                  )}

                  {/* STATE 6: API ERROR */}
                  {geofenceUIState === 'API_ERROR' && (
                    <View>
                      <AppButton
                        onPress={checkLocationAndGeofence}
                        loading={verifyingGeofence}
                        style={[styles.actionBtn, { backgroundColor: '#D97706' }]}
                        textColor="#FFFFFF"
                        icon="reload"
                      >
                        RETRY LOCATION CHECK
                      </AppButton>
                      <Text style={styles.actionSubtitle}>
                        Could not verify location with server. Tap to retry.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* TODAY'S METRICS SECTION */}
        <Text style={styles.sectionHeading}>Today's Metrics</Text>
        <View style={styles.metricsGrid}>
          {/* First Check-In */}
          <Card style={styles.metricCard} mode="outlined">
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons
                name="login-variant"
                size={18}
                color={palette.primary}
                style={styles.metricIcon}
              />
              <Text style={styles.metricLabel}>First Check-In</Text>
              <Text style={styles.metricVal}>
                {formatTime(todayData?.sessions[0]?.checkInAt)}
              </Text>
            </Card.Content>
          </Card>

          {/* Last Check-Out */}
          <Card style={styles.metricCard} mode="outlined">
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons
                name="logout-variant"
                size={18}
                color={palette.muted}
                style={styles.metricIcon}
              />
              <Text style={styles.metricLabel}>Last Check-Out</Text>
              <Text style={styles.metricVal}>
                {formatTime(latestSession?.checkOutAt)}
              </Text>
            </Card.Content>
          </Card>

          {/* Today's Status */}
          <Card style={styles.metricCard} mode="outlined">
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons
                name={isWorking ? 'briefcase-clock' : 'check-circle-outline'}
                size={18}
                color={
                  isWorking
                    ? palette.success
                    : isAutoCheckedOut
                    ? '#D97706'
                    : palette.primary
                }
                style={styles.metricIcon}
              />
              <Text style={styles.metricLabel}>Today's Status</Text>
              <Text
                style={[
                  styles.metricVal,
                  {
                    color: isWorking
                      ? palette.success
                      : isPaused
                      ? '#D97706'
                      : isAutoCheckedOut
                      ? '#D97706'
                      : todayData?.sessions.length
                      ? palette.primary
                      : palette.muted,
                  },
                ]}
                numberOfLines={1}
              >
                {isWorking
                  ? 'Working'
                  : isPaused
                  ? 'Paused (Grace)'
                  : isAutoCheckedOut
                  ? 'Auto Checked Out'
                  : todayData?.sessions.length
                  ? 'Completed'
                  : 'Not Checked In'}
              </Text>
            </Card.Content>
          </Card>

          {/* Punctuality */}
          <Card style={styles.metricCard} mode="outlined">
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={18}
                color={palette.primary}
                style={styles.metricIcon}
              />
              <Text style={styles.metricLabel}>Punctuality</Text>
              <Text style={styles.metricVal}>
                {todayData?.sessions[0]?.checkInStatus?.replace('_', ' ') ||
                  (todayData?.sessions.length ? 'On Time' : '—')}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* NAVIGATION TO FULL HISTORY */}
        <TouchableOpacity
          style={styles.historyBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('AttendanceHistory')}
        >
          <Text style={styles.historyBtnText}>View Full Attendance History</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={palette.primary} />
        </TouchableOpacity>
      </ScrollView>

      {/* Right-Side Sliding Profile Drawer */}
      <ProfileDrawer
        visible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        onNavigateProfile={() => navigation.navigate('Profile')}
        onNavigateNotifications={() => navigation.navigate('Notifications')}
        onLogout={() => {
          Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
          ]);
        }}
        user={user}
        employeeProfile={employeeProfile}
        unreadCount={unreadCount}
      />

      {/* Live Face Biometric Verification Modal for Check-In & Check-Out */}
      <FaceCameraModal
        visible={faceModalVisible}
        mode={faceModalMode}
        employeeId={employeeProfile?.employeeCode || employeeProfile?.id || ''}
        officeName={officeDisplayName}
        onVerified={(token, photoUri) => {
          setFaceModalVisible(false);
          if (faceModalMode === 'checkIn') {
            void handleConfirmCheckIn(token, photoUri);
          } else {
            void handleCheckOut(token);
          }
        }}
        onCancel={() => setFaceModalVisible(false)}
      />

      {/* Attendance Verification & Photo Capture Modal */}
      <Modal
        visible={isCheckInModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!actionLoading) {
            setIsCheckInModalVisible(false);
            setAttendancePhoto(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Attendance Check-In</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!actionLoading) {
                    setIsCheckInModalVisible(false);
                    setAttendancePhoto(null);
                  }
                }}
              >
                <MaterialCommunityIcons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <Divider style={{ marginVertical: 12 }} />

            {/* Office & Geofence Verification Status */}
            <View style={styles.modalInfoRow}>
              <MaterialCommunityIcons name="office-building" size={20} color={palette.primary} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.modalLabel}>Assigned Office</Text>
                <Text style={styles.modalValue}>{officeDisplayName} ({officeDisplayCode})</Text>
              </View>
            </View>

            <View style={[styles.modalInfoRow, { marginTop: 10 }]}>
              <MaterialCommunityIcons name="check-decagram" size={20} color={palette.success} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.modalLabel}>Location Status</Text>
                <Text style={[styles.modalValue, { color: palette.success }]}>
                  Verified • Inside Office Geofence
                </Text>
              </View>
            </View>

            {/* Attendance Photo Preview / Camera Prompt */}
            <View style={styles.attendancePhotoSection}>
              {attendancePhoto ? (
                <View style={{ alignItems: 'center' }}>
                  <Image source={{ uri: attendancePhoto }} style={styles.attendancePhotoThumb} />
                  <View style={styles.photoVerifiedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={palette.success} />
                    <Text style={styles.photoVerifiedText}>Photo Captured</Text>
                  </View>
                  <AppButton
                    mode="text"
                    onPress={handleOpenAttendanceCamera}
                    disabled={actionLoading}
                    icon="camera-retake"
                    style={{ marginTop: 4 }}
                  >
                    Retake Photo
                  </AppButton>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={styles.emptyCameraBox}>
                    <MaterialCommunityIcons name="camera-outline" size={38} color={palette.primary} />
                  </View>
                  <Text style={styles.cameraInstructions}>
                    A live verification selfie is required to confirm presence inside the office before check-in.
                  </Text>
                  <AppButton
                    mode="contained"
                    onPress={handleOpenAttendanceCamera}
                    icon="camera"
                    style={{ marginTop: 12, width: '100%' }}
                  >
                    Open Camera
                  </AppButton>
                </View>
              )}
            </View>

            {/* Confirm Check-In Action Button */}
            {attendancePhoto && (
              <AppButton
                mode="contained"
                onPress={() => void handleConfirmCheckIn()}
                loading={actionLoading}
                disabled={actionLoading}
                style={[styles.confirmCheckInBtn, { backgroundColor: palette.success }]}
              >
                CONFIRM CHECK-IN
              </AppButton>
            )}
          </View>
        </View>
      </Modal>

      {/* Check-In Success Modal */}
      <Modal
        visible={Boolean(checkInSuccessModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckInSuccessModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: 28 }]}>
            <View style={styles.successIconCircle}>
              <MaterialCommunityIcons name="check" size={42} color="#FFFFFF" />
            </View>
            <Text style={styles.successHeading}>Check-in Successful!</Text>
            <Text style={styles.successSubheading}>
              Check-in Time: {checkInSuccessModal?.checkInTime}
            </Text>
            <Text style={styles.successDesc}>Your working duration has started.</Text>

            <AppButton
              mode="contained"
              onPress={() => setCheckInSuccessModal(null)}
              style={{ marginTop: 20, width: '100%' }}
            >
              Go to Home
            </AppButton>
          </View>
        </View>
      </Modal>

      {/* Check-Out Success Modal */}
      <Modal
        visible={Boolean(checkOutSuccessModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckOutSuccessModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: 28 }]}>
            <View style={[styles.successIconCircle, { backgroundColor: palette.primary }]}>
              <MaterialCommunityIcons name="briefcase-check" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.successHeading}>Check-out Successful!</Text>

            <Card style={styles.checkoutSummaryCard} mode="outlined">
              <Card.Content>
                <View style={styles.infoRowModal}>
                  <Text style={styles.infoRowKey}>Check-in Time:</Text>
                  <Text style={styles.infoRowVal}>{checkOutSuccessModal?.checkInTime}</Text>
                </View>
                <View style={styles.infoRowModal}>
                  <Text style={styles.infoRowKey}>Check-out Time:</Text>
                  <Text style={styles.infoRowVal}>{checkOutSuccessModal?.checkOutTime}</Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.infoRowModal}>
                  <Text style={[styles.infoRowKey, { fontWeight: '700' }]}>Total Working Duration:</Text>
                  <Text style={[styles.infoRowVal, { color: palette.primary, fontWeight: '700' }]}>
                    {checkOutSuccessModal?.duration}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            <AppButton
              mode="contained"
              onPress={() => setCheckOutSuccessModal(null)}
              style={{ marginTop: 16, width: '100%' }}
            >
              Done
            </AppButton>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.3,
  },
  subGreeting: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  profileBtn: {
    position: 'relative',
    padding: 2,
  },
  avatar: {
    backgroundColor: palette.primary,
  },
  avatarLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: palette.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: palette.background,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // Permission Banner Card
  permissionCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderRadius: 14,
    marginBottom: 16,
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  permissionIconWrap: {
    marginTop: 2,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  permissionActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  settingsBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  settingsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  recheckBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  recheckBtnText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },

  // SECTION 5: Office Card
  officeCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  officeCardContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  officeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  officeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  officeSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: 0.6,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  activeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.success,
  },
  activeBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  unassignedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unassignedBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  multiOfficeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  multiOfficeBadgeText: {
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '700',
  },
  multiOfficeBox: {
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  multiOfficeBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  multiOfficeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  multiOfficeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: 5,
  },
  multiOfficeChipSelected: {
    borderColor: palette.primary,
    backgroundColor: '#EFF6FF',
  },
  multiOfficeChipInside: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  multiOfficeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
  multiOfficeChipTextSelected: {
    color: palette.primary,
    fontWeight: '700',
  },
  multiOfficeChipTextInside: {
    color: '#15803D',
    fontWeight: '700',
  },
  chipInsideDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginLeft: 2,
  },
  officeDivider: {
    marginVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  officeMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  officeNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.ink,
  },
  officeCodeText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  refreshOfficeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 5,
  },
  refreshOfficeText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  officeDetailsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 12,
  },
  officeDetailItem: {
    flex: 1,
  },
  officeDetailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  officeDetailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink,
  },
  officeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  officeLocationText: {
    fontSize: 11,
    color: palette.muted,
  },

  // No Office Box
  noOfficeBox: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  noOfficeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  noOfficeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  noOfficeDesc: {
    fontSize: 12,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  noOfficeRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#EEF2F6',
  },
  noOfficeRefreshText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  // SECTION 7: Geofence Card
  geofenceCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  geofenceCardInside: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  geofenceCardOutside: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  geofenceCardNeutral: {
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  geofenceContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8,
  },
  geofenceTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  refreshBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#EEF2F6',
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyingText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  geoDivider: {
    marginVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  coordsText: {
    fontSize: 11,
    color: palette.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  insideNotice: {
    marginTop: 6,
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  insideText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
    lineHeight: 17,
  },
  insideSubtext: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  outsideNotice: {
    marginTop: 6,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  outsideText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
    lineHeight: 17,
  },
  outsideDistanceText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '700',
    marginTop: 2,
  },
  outsideSubtext: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
  checkingNotice: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  checkingText: {
    fontSize: 12,
    color: palette.muted,
    flex: 1,
  },
  noOfficeNotice: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
  },
  noOfficeNoticeText: {
    fontSize: 12,
    color: palette.muted,
    flex: 1,
    lineHeight: 17,
  },
  errorNotice: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
  },
  errorNoticeText: {
    fontSize: 12,
    color: palette.error,
    fontWeight: '600',
  },
  errorRetryText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  noticeIconWrap: {
    marginTop: 1,
  },

  // SECTION 8: Tracker & Check-In Action Card
  trackerCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  trackerContent: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  trackerHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clockContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  clockText: {
    fontSize: 44,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.success,
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.success,
    letterSpacing: 0.5,
  },
  autoCheckOutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  autoCheckOutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  actionContainer: {
    width: '100%',
    marginTop: 8,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  actionSubtitle: {
    textAlign: 'center',
    fontSize: 11,
    color: palette.muted,
    marginTop: 8,
    fontWeight: '500',
  },

  // Today's Metrics
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.ink,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 12,
  },
  metricContent: {
    padding: 12,
    alignItems: 'center',
  },
  metricIcon: {
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: palette.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.ink,
  },
  historyBtn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  historyBtnText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
    marginTop: 1,
  },
  attendancePhotoSection: {
    marginVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  emptyCameraBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cameraInstructions: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  attendancePhotoThumb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: palette.success,
  },
  photoVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
    gap: 4,
  },
  photoVerifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  confirmCheckInBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 4,
    width: '100%',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  successSubheading: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  successDesc: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'center',
  },
  checkoutSummaryCard: {
    width: '100%',
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderColor: palette.border,
    borderRadius: 12,
  },
  infoRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoRowKey: {
    fontSize: 13,
    color: palette.muted,
  },
  infoRowVal: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink,
  },
  // Grace Period & Paused Session Card Styles
  graceCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  graceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  graceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  graceTimerWrap: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 10,
  },
  graceTimerDigits: {
    fontSize: 34,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#B45309',
    letterSpacing: 2,
  },
  graceTimerDigitsUrgent: {
    color: '#DC2626',
  },
  graceTimerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 4,
    textAlign: 'center',
  },
  graceDesc: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 10,
  },
  graceDeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  graceDeadlineText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  graceBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  graceResumeBtn: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  graceResumeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  graceCheckoutBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  graceCheckoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  specialConditionCard: {
    backgroundColor: '#F5F3FF',
    borderColor: '#C4B5FD',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  specialConditionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  specialConditionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6D28D9',
  },
  specialConditionBadge: {
    backgroundColor: '#DDD6FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specialConditionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5B21B6',
  },
  specialConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  specialConditionStat: {
    alignItems: 'center',
    flex: 1,
  },
  specialConditionStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  specialConditionStatVal: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: palette.ink,
  },
  specialConditionDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  specialConditionReasonText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6D28D9',
    marginTop: 6,
  },
});
