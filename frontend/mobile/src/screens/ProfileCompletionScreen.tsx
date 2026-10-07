import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  Card,
  Chip,
  Divider,
  HelperText,
  ProgressBar,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import { ErrorMessage } from '../components/ErrorMessage';
import { useAuth } from '../context/AuthContext';
import { updateEmployeeMe } from '../api/employeeApi';
import { palette } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';

type GenderOption = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

const GENDER_OPTIONS: { label: string; value: GenderOption }[] = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
  { label: 'Prefer not to say', value: 'PREFER_NOT_TO_SAY' },
];

const RELATION_OPTIONS = [
  'Parent',
  'Spouse',
  'Sibling',
  'Child',
  'Guardian',
  'Friend',
  'Other',
];

const TOTAL_STEPS = 7;

const STEP_TITLES = [
  'Personal Information',
  'Contact Details',
  'Employment Details',
  'Emergency Contact',
  'Profile Photo',
  'Permissions Setup',
  'Review & Finish',
];

/**
 * Parses user-entered date string in multiple common formats:
 * - DD/MM/YYYY or DD-MM-YYYY
 * - YYYY-MM-DD or YYYY/MM/DD
 * Returns normalized 'YYYY-MM-DD', exact calendar-calculated age, and error message.
 */
function parseAndNormalizeDate(input: string): {
  normalized: string | null;
  age: number | null;
  error: string | null;
} {
  const clean = input.trim();
  if (!clean) {
    return { normalized: null, age: null, error: 'Date of birth is required' };
  }

  let year: number;
  let month: number;
  let day: number;

  const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
  } else if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  } else {
    return {
      normalized: null,
      age: null,
      error: 'Enter date as DD/MM/YYYY or YYYY-MM-DD',
    };
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { normalized: null, age: null, error: 'Invalid calendar month or day' };
  }

  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return { normalized: null, age: null, error: 'Invalid calendar date' };
  }

  const today = new Date();
  if (birthDate > today) {
    return { normalized: null, age: null, error: 'Date of birth cannot be in the future' };
  }

  // Exact calendar calculation (accounting for month and day)
  let calculatedAge = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    calculatedAge--;
  }

  if (calculatedAge < 18) {
    return {
      normalized: null,
      age: calculatedAge >= 0 ? calculatedAge : 0,
      error: 'Employee must be at least 18 years old',
    };
  }

  if (calculatedAge > 100) {
    return {
      normalized: null,
      age: calculatedAge,
      error: 'Please enter a valid birth year',
    };
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const normalized = `${year}-${mm}-${dd}`;

  return {
    normalized,
    age: calculatedAge,
    error: null,
  };
}

export default function ProfileCompletionScreen() {
  const navigation = useNavigation<any>();
  const { user, employeeProfile, refreshProfile, setProfileCompletedManually, logout } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Section A & B: Personal Information
  const [personalEmail, setPersonalEmail] = useState(employeeProfile?.personalEmail ?? '');
  const [phone, setPhone] = useState(employeeProfile?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(
    employeeProfile?.dateOfBirth ? String(employeeProfile.dateOfBirth).slice(0, 10) : '',
  );
  const [gender, setGender] = useState<GenderOption | null>(
    (employeeProfile?.gender as GenderOption) ?? null,
  );

  // Section C: Contact Information
  const [alternatePhone, setAlternatePhone] = useState(employeeProfile?.alternatePhone ?? '');
  const [address, setAddress] = useState(employeeProfile?.address ?? '');
  const [permanentAddress, setPermanentAddress] = useState(
    employeeProfile?.permanentAddress ?? employeeProfile?.address ?? '',
  );
  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  // Section E: Emergency Contact
  const [emergencyName, setEmergencyName] = useState(employeeProfile?.emergencyContactName ?? '');
  const [emergencyRelation, setEmergencyRelation] = useState(
    employeeProfile?.emergencyContactRelation ?? 'Parent',
  );
  const [emergencyPhone, setEmergencyPhone] = useState(employeeProfile?.emergencyContactPhone ?? '');

  // Section 6: Profile Photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(
    employeeProfile?.profilePhotoUrl ?? null,
  );

  // Section 7 & 8: Permissions
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locationLoading, setLocationLoading] = useState(false);

  // Sync initial values from profile
  useEffect(() => {
    if (employeeProfile) {
      if (!personalEmail && employeeProfile.personalEmail) setPersonalEmail(employeeProfile.personalEmail);
      if (!phone && employeeProfile.phone) setPhone(employeeProfile.phone);
      if (!dateOfBirth && employeeProfile.dateOfBirth) {
        setDateOfBirth(String(employeeProfile.dateOfBirth).slice(0, 10));
      }
      if (!gender && employeeProfile.gender) setGender(employeeProfile.gender as GenderOption);
      if (!address && employeeProfile.address) setAddress(employeeProfile.address);
      if (!permanentAddress && employeeProfile.permanentAddress) {
        setPermanentAddress(employeeProfile.permanentAddress);
      }
      if (!alternatePhone && employeeProfile.alternatePhone) {
        setAlternatePhone(employeeProfile.alternatePhone);
      }
      if (!emergencyName && employeeProfile.emergencyContactName) {
        setEmergencyName(employeeProfile.emergencyContactName);
      }
      if (!emergencyRelation && employeeProfile.emergencyContactRelation) {
        setEmergencyRelation(employeeProfile.emergencyContactRelation);
      }
      if (!emergencyPhone && employeeProfile.emergencyContactPhone) {
        setEmergencyPhone(employeeProfile.emergencyContactPhone);
      }
      if (!profilePhoto && employeeProfile.profilePhotoUrl) {
        setProfilePhoto(employeeProfile.profilePhotoUrl);
      }
    }
  }, [employeeProfile]);

  // Check initial permissions
  useEffect(() => {
    void (async () => {
      try {
        const { status: camStatus } = await ImagePicker.getCameraPermissionsAsync();
        if (camStatus === 'granted') setCameraPermissionGranted(true);
      } catch {}

      try {
        const { status: locStatus } = await Location.getForegroundPermissionsAsync();
        if (locStatus === 'granted') setLocationPermissionGranted(true);
      } catch {}
    })();
  }, []);

  // Sync sameAsCurrent address
  const handleToggleSameAddress = () => {
    const next = !sameAsCurrent;
    setSameAsCurrent(next);
    if (next) {
      setPermanentAddress(address);
    }
  };

  // DOB parsing and dynamic age
  const parsedDob = useMemo(() => {
    return parseAndNormalizeDate(dateOfBirth);
  }, [dateOfBirth]);

  // Step Validation
  const validateCurrentStep = (): boolean => {
    setStepError(null);

    if (currentStep === 1) {
      if (!personalEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail.trim())) {
        setStepError('Please enter a valid personal email address.');
        return false;
      }
      if (!phone.trim() || phone.trim().length < 7) {
        setStepError('Please enter a valid mobile number (at least 7 digits).');
        return false;
      }
      if (parsedDob.error) {
        setStepError(parsedDob.error);
        return false;
      }
      if (!gender) {
        setStepError('Please select your gender.');
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      if (!address.trim() || address.trim().length < 5) {
        setStepError('Current residential address must be at least 5 characters.');
        return false;
      }
      const perm = sameAsCurrent ? address : permanentAddress;
      if (!perm.trim() || perm.trim().length < 5) {
        setStepError('Permanent residential address is required.');
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      // Employment info is read-only
      return true;
    }

    if (currentStep === 4) {
      if (!emergencyName.trim()) {
        setStepError('Emergency contact name is required.');
        return false;
      }
      if (!emergencyPhone.trim() || emergencyPhone.trim().length < 7) {
        setStepError('Please enter a valid emergency contact phone number.');
        return false;
      }
      return true;
    }

    if (currentStep === 5) {
      // Photo is recommended but optional to advance
      return true;
    }

    if (currentStep === 6) {
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleBack = () => {
    setStepError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Camera Permission Handler
  const handleRequestCameraPermission = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === 'granted') {
        setCameraPermissionGranted(true);
      } else {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required for attendance verification. Please enable camera permission in device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to request camera permission.');
    }
  };

  // Location Permission Handler
  const handleRequestLocationPermission = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } else {
        Alert.alert(
          'Location Permission Required',
          'Momo HRMS needs your location to verify office geofence during check-in. Please enable location in device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch {
      Alert.alert('Error', 'Unable to retrieve GPS coordinates.');
    } finally {
      setLocationLoading(false);
    }
  };

  // Take photo with camera
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take a profile photo.');
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
        setProfilePhoto(dataUri);
      }
    } catch (err: unknown) {
      Alert.alert('Camera Error', getErrorMessage(err, 'Could not open camera.'));
    }
  };

  // Choose photo from gallery
  const handlePickGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is required to choose a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProfilePhoto(dataUri);
      }
    } catch (err: unknown) {
      Alert.alert('Gallery Error', getErrorMessage(err, 'Could not select photo.'));
    }
  };

  // Final Complete Onboarding Submission
  const handleCompleteOnboarding = async () => {
    setSaving(true);
    setStepError(null);

    try {
      const finalPermanent = sameAsCurrent ? address.trim() : permanentAddress.trim();

      await updateEmployeeMe({
        personalEmail: personalEmail.trim(),
        phone: phone.trim(),
        dateOfBirth: parsedDob.normalized ?? undefined,
        gender: gender ?? undefined,
        address: address.trim(),
        permanentAddress: finalPermanent || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactRelation: emergencyRelation || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
        profilePhotoUrl: profilePhoto || undefined,
        isOnboarded: true,
      });

      await refreshProfile();
      setProfileCompletedManually();
      setSaving(false);

      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'EmployeeHome' }],
        });
      } catch {
        // Handled by RootNavigator state change
      }
    } catch (err: unknown) {
      setStepError(getErrorMessage(err, 'Failed to save onboarding profile. Please check the fields.'));
      setSaving(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const employeeFullName = employeeProfile?.firstName
    ? `${employeeProfile.firstName} ${employeeProfile.lastName}`
    : user?.fullName || 'Employee';

  const assignedOfficeDisplay =
    employeeProfile?.assignedOffice?.name ||
    employeeProfile?.officeLocationName ||
    employeeProfile?.officeLocationId ||
    'Wakad (PN-001)';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header & Step Indicator */}
          <AppHeader
            title="Employee Onboarding"
            subtitle={`Step ${currentStep} of ${TOTAL_STEPS} — ${STEP_TITLES[currentStep - 1]}`}
          />

          <ProgressBar
            progress={currentStep / TOTAL_STEPS}
            color={palette.primary}
            style={styles.progressBar}
          />

          <ErrorMessage message={stepError} />

          {/* ================= STEP 1: PERSONAL INFORMATION ================= */}
          {currentStep === 1 && (
            <View>
              <Card style={styles.card} mode="outlined">
                <Card.Content>
                  <Text style={styles.labelMuted}>Full Legal Name (From Admin)</Text>
                  <Text style={styles.valueStrong}>{employeeFullName}</Text>
                  {employeeProfile?.employeeCode && (
                    <Text style={styles.codeText}>ID: {employeeProfile.employeeCode}</Text>
                  )}
                </Card.Content>
              </Card>

              <AppTextInput
                label="Personal Email *"
                value={personalEmail}
                onChangeText={(t) => {
                  setPersonalEmail(t);
                  if (stepError) setStepError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="e.g. yourname@gmail.com"
                left={<TextInput.Icon icon="email-outline" />}
              />

              <AppTextInput
                label="Mobile Phone Number *"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  if (stepError) setStepError(null);
                }}
                keyboardType="phone-pad"
                placeholder="e.g. +91 9876543210"
                left={<TextInput.Icon icon="phone-outline" />}
              />

              <AppTextInput
                label="Date of Birth (DD/MM/YYYY or YYYY-MM-DD) *"
                value={dateOfBirth}
                onChangeText={(t) => {
                  setDateOfBirth(t);
                  if (stepError) setStepError(null);
                }}
                placeholder="e.g. 03/04/2000"
                maxLength={10}
                left={<TextInput.Icon icon="calendar" />}
              />

              {/* Dynamic Age Badge */}
              <View style={styles.ageContainer}>
                <Text style={styles.ageLabel}>Age (Derived from Date of Birth):</Text>
                {parsedDob.age !== null ? (
                  <View style={styles.ageBadge}>
                    <Text style={styles.ageText}>{parsedDob.age} years</Text>
                  </View>
                ) : (
                  <Text style={styles.agePlaceholder}>Enter valid DOB above</Text>
                )}
              </View>
              <HelperText type="info" visible style={styles.helperText}>
                Age is calculated dynamically from your birth date and is non-editable.
              </HelperText>

              {/* Gender */}
              <Text style={styles.sectionLabel}>Gender *</Text>
              <View style={styles.chipRow}>
                {GENDER_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    selected={gender === opt.value}
                    onPress={() => {
                      setGender(opt.value);
                      if (stepError) setStepError(null);
                    }}
                    style={[
                      styles.chip,
                      gender === opt.value && { backgroundColor: palette.primary },
                    ]}
                    textStyle={{
                      color: gender === opt.value ? '#FFFFFF' : palette.ink,
                      fontWeight: gender === opt.value ? '700' : '400',
                    }}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {/* ================= STEP 2: CONTACT INFORMATION ================= */}
          {currentStep === 2 && (
            <View>
              <AppTextInput
                label="Personal Email"
                value={personalEmail}
                editable={false}
                left={<TextInput.Icon icon="email-outline" />}
              />

              <AppTextInput
                label="Primary Mobile Number"
                value={phone}
                editable={false}
                left={<TextInput.Icon icon="phone-outline" />}
              />

              <AppTextInput
                label="Alternate Mobile Number (Optional)"
                value={alternatePhone}
                onChangeText={setAlternatePhone}
                keyboardType="phone-pad"
                placeholder="e.g. +91 9123456780"
                left={<TextInput.Icon icon="phone-plus-outline" />}
              />

              <AppTextInput
                label="Current Residential Address *"
                value={address}
                onChangeText={(t) => {
                  setAddress(t);
                  if (sameAsCurrent) setPermanentAddress(t);
                  if (stepError) setStepError(null);
                }}
                multiline
                numberOfLines={3}
                placeholder="Flat / Building, Street, City, State, PIN"
                left={<TextInput.Icon icon="home-outline" />}
                right={<TextInput.Icon icon="keyboard-close" onPress={() => Keyboard.dismiss()} />}
              />

              <TouchableOpacity style={styles.checkboxRow} onPress={handleToggleSameAddress}>
                <MaterialCommunityIcons
                  name={sameAsCurrent ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={palette.primary}
                />
                <Text style={styles.checkboxLabel}>Permanent address is same as current address</Text>
              </TouchableOpacity>

              {!sameAsCurrent && (
                <AppTextInput
                  label="Permanent Address *"
                  value={permanentAddress}
                  onChangeText={(t) => {
                    setPermanentAddress(t);
                    if (stepError) setStepError(null);
                  }}
                  multiline
                  numberOfLines={3}
                  placeholder="Permanent hometown address, City, PIN"
                  left={<TextInput.Icon icon="map-marker-outline" />}
                  right={<TextInput.Icon icon="keyboard-close" onPress={() => Keyboard.dismiss()} />}
                />
              )}
            </View>
          )}

          {/* ================= STEP 3: EMPLOYMENT INFORMATION (READ ONLY) ================= */}
          {currentStep === 3 && (
            <View>
              <Card style={styles.card} mode="outlined">
                <Card.Content>
                  <Text style={styles.cardSectionTitle}>Official Record Details</Text>
                  <Text style={styles.readOnlyNote}>
                    These parameters are officially provisioned by HR/Admin and cannot be modified by the employee.
                  </Text>
                  <Divider style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Employee ID:</Text>
                    <Text style={styles.infoVal}>{employeeProfile?.employeeCode || 'EMP-001'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Company Email:</Text>
                    <Text style={styles.infoVal}>{employeeProfile?.email || user?.email || '—'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Department:</Text>
                    <Text style={styles.infoVal}>
                      {employeeProfile?.department?.name || 'Engineering'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Designation:</Text>
                    <Text style={styles.infoVal}>
                      {employeeProfile?.jobTitle || employeeProfile?.designation?.title || 'Associate'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Joining Date:</Text>
                    <Text style={styles.infoVal}>
                      {employeeProfile?.dateOfJoining
                        ? new Date(employeeProfile.dateOfJoining).toLocaleDateString()
                        : 'Today'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Employment Type:</Text>
                    <Text style={styles.infoVal}>
                      {employeeProfile?.employmentStatus || employeeProfile?.status || 'ACTIVE'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Assigned Office:</Text>
                    <Text style={[styles.infoVal, { color: palette.primary, fontWeight: '700' }]}>
                      {assignedOfficeDisplay}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            </View>
          )}

          {/* ================= STEP 4: EMERGENCY CONTACT ================= */}
          {currentStep === 4 && (
            <View>
              <AppTextInput
                label="Emergency Contact Name *"
                value={emergencyName}
                onChangeText={(t) => {
                  setEmergencyName(t);
                  if (stepError) setStepError(null);
                }}
                placeholder="e.g. Ramesh Patil"
                left={<TextInput.Icon icon="account-alert-outline" />}
              />

              <Text style={styles.sectionLabel}>Relationship *</Text>
              <View style={styles.chipRow}>
                {RELATION_OPTIONS.map((rel) => (
                  <Chip
                    key={rel}
                    selected={emergencyRelation === rel}
                    onPress={() => setEmergencyRelation(rel)}
                    style={[
                      styles.chip,
                      emergencyRelation === rel && { backgroundColor: palette.primary },
                    ]}
                    textStyle={{
                      color: emergencyRelation === rel ? '#FFFFFF' : palette.ink,
                      fontWeight: emergencyRelation === rel ? '700' : '400',
                    }}
                  >
                    {rel}
                  </Chip>
                ))}
              </View>

              <AppTextInput
                label="Emergency Contact Phone Number *"
                value={emergencyPhone}
                onChangeText={(t) => {
                  setEmergencyPhone(t);
                  if (stepError) setStepError(null);
                }}
                keyboardType="phone-pad"
                placeholder="e.g. +91 9988776655"
                left={<TextInput.Icon icon="phone-alert-outline" />}
              />
            </View>
          )}

          {/* ================= STEP 5: PROFILE PHOTO ================= */}
          {currentStep === 5 && (
            <View style={styles.photoContainer}>
              <View style={styles.avatarWrapper}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.photoPreview} />
                ) : (
                  <Avatar.Icon size={120} icon="account" style={{ backgroundColor: palette.border }} />
                )}
              </View>

              <Text style={styles.photoPrompt}>
                Upload a clear profile photo for your employee badge and dashboard.
              </Text>

              <View style={styles.photoButtonRow}>
                <AppButton
                  mode="contained"
                  onPress={handleTakePhoto}
                  style={styles.photoBtn}
                  icon="camera"
                >
                  Take Photo
                </AppButton>
                <AppButton
                  mode="outlined"
                  onPress={handlePickGallery}
                  style={styles.photoBtn}
                  icon="image"
                >
                  Gallery
                </AppButton>
              </View>

              {profilePhoto && (
                <AppButton
                  mode="text"
                  onPress={() => setProfilePhoto(null)}
                  style={{ marginTop: 8 }}
                  textColor={palette.error}
                >
                  Remove Photo
                </AppButton>
              )}
            </View>
          )}

          {/* ================= STEP 6: PERMISSIONS SETUP ================= */}
          {currentStep === 6 && (
            <View>
              {/* Camera Permission Card */}
              <Card style={styles.card} mode="outlined">
                <Card.Content>
                  <View style={styles.permHeader}>
                    <MaterialCommunityIcons
                      name="camera-outline"
                      size={32}
                      color={cameraPermissionGranted ? palette.success : palette.primary}
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.permTitle}>Camera Permission</Text>
                      <Text style={styles.permDesc}>
                        Momo HRMS needs camera access for biometric attendance verification during
                        check-in and check-out.
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 12 }}>
                    {cameraPermissionGranted ? (
                      <Chip icon="check-circle" style={{ backgroundColor: '#E8F5E9' }}>
                        Camera Access Granted
                      </Chip>
                    ) : (
                      <AppButton mode="contained" onPress={handleRequestCameraPermission}>
                        Allow Camera Access
                      </AppButton>
                    )}
                  </View>
                </Card.Content>
              </Card>

              {/* Location Permission Card */}
              <Card style={styles.card} mode="outlined">
                <Card.Content>
                  <View style={styles.permHeader}>
                    <MaterialCommunityIcons
                      name="map-marker-radius-outline"
                      size={32}
                      color={locationPermissionGranted ? palette.success : palette.primary}
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.permTitle}>Location Permission</Text>
                      <Text style={styles.permDesc}>
                        Momo HRMS uses your location to verify that your attendance is marked within
                        your assigned office geofence.
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 12 }}>
                    {locationPermissionGranted ? (
                      <Chip icon="check-circle" style={{ backgroundColor: '#E8F5E9' }}>
                        {currentCoords
                          ? `Location Verified (${currentCoords.latitude.toFixed(3)}, ${currentCoords.longitude.toFixed(3)})`
                          : 'Location Access Granted'}
                      </Chip>
                    ) : (
                      <AppButton
                        mode="contained"
                        onPress={handleRequestLocationPermission}
                        loading={locationLoading}
                        disabled={locationLoading}
                      >
                        Allow Location Access
                      </AppButton>
                    )}
                  </View>
                </Card.Content>
              </Card>
            </View>
          )}

          {/* ================= STEP 7: REVIEW & COMPLETE ================= */}
          {currentStep === 7 && (
            <View>
              <Card style={styles.card} mode="outlined">
                <Card.Content>
                  <Text style={styles.cardSectionTitle}>Onboarding Summary</Text>
                  <Text style={styles.readOnlyNote}>
                    Review your completed sections. Once submitted, your profile will be locked and
                    ready for attendance marking.
                  </Text>
                  <Divider style={styles.divider} />

                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={palette.success} />
                    <Text style={styles.summaryText}>Personal Information Verified</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={palette.success} />
                    <Text style={styles.summaryText}>Contact & Residential Address Saved</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={palette.success} />
                    <Text style={styles.summaryText}>Assigned Workplace: {assignedOfficeDisplay}</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={palette.success} />
                    <Text style={styles.summaryText}>Emergency Contact: {emergencyName} ({emergencyRelation})</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons
                      name={profilePhoto ? 'check-circle' : 'information'}
                      size={20}
                      color={profilePhoto ? palette.success : palette.muted}
                    />
                    <Text style={styles.summaryText}>
                      Profile Photo: {profilePhoto ? 'Uploaded' : 'Default Badge Assigned'}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons
                      name={cameraPermissionGranted ? 'check-circle' : 'alert-circle'}
                      size={20}
                      color={cameraPermissionGranted ? palette.success : palette.error}
                    />
                    <Text style={styles.summaryText}>
                      Camera Access: {cameraPermissionGranted ? 'Granted' : 'Pending Request'}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons
                      name={locationPermissionGranted ? 'check-circle' : 'alert-circle'}
                      size={20}
                      color={locationPermissionGranted ? palette.success : palette.error}
                    />
                    <Text style={styles.summaryText}>
                      Location Access: {locationPermissionGranted ? 'Granted' : 'Pending Request'}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            </View>
          )}

          {/* Action Navigation Controls */}
          <View style={styles.buttonContainer}>
            {currentStep < TOTAL_STEPS ? (
              <View style={styles.stepButtonRow}>
                {currentStep > 1 && (
                  <AppButton mode="outlined" onPress={handleBack} style={styles.halfBtn}>
                    Back
                  </AppButton>
                )}
                <AppButton
                  mode="contained"
                  onPress={handleNext}
                  style={currentStep === 1 ? styles.fullBtn : styles.halfBtn}
                >
                  Continue
                </AppButton>
              </View>
            ) : (
              <View>
                <AppButton
                  mode="contained"
                  onPress={handleCompleteOnboarding}
                  loading={saving}
                  disabled={saving}
                  style={styles.fullBtn}
                >
                  Complete Onboarding & Enter Home
                </AppButton>
                <AppButton mode="text" onPress={handleBack} disabled={saving} style={{ marginTop: 8 }}>
                  Review Previous Steps
                </AppButton>
              </View>
            )}

            <TouchableOpacity style={styles.logoutBtn} onPress={() => void logout()} disabled={saving}>
              <Text style={styles.logoutText}>Log out and continue later</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  progressBar: { height: 6, borderRadius: 3, marginBottom: 16, backgroundColor: palette.border },
  card: { backgroundColor: palette.surface, borderColor: palette.border, marginBottom: 16 },
  cardSectionTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  readOnlyNote: { fontSize: 12, color: palette.muted, marginTop: 4 },
  divider: { marginVertical: 12 },
  labelMuted: { fontSize: 11, color: palette.muted, textTransform: 'uppercase', fontWeight: '700' },
  valueStrong: { fontSize: 18, fontWeight: '700', color: palette.ink, marginTop: 4 },
  codeText: { fontSize: 13, color: palette.primary, marginTop: 2, fontWeight: '600' },
  ageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    marginTop: 4,
  },
  ageLabel: { fontSize: 13, fontWeight: '600', color: palette.ink },
  ageBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  ageText: { color: palette.success, fontWeight: '700', fontSize: 13 },
  agePlaceholder: { fontSize: 12, color: palette.muted, fontStyle: 'italic' },
  helperText: { paddingHorizontal: 0, marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: palette.ink, marginTop: 8, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: palette.surface, borderRadius: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 4 },
  checkboxLabel: { marginLeft: 8, fontSize: 13, color: palette.ink, fontWeight: '500' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  infoKey: { fontSize: 13, color: palette.muted, fontWeight: '500' },
  infoVal: { fontSize: 13, color: palette.ink, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 8 },
  photoContainer: { alignItems: 'center', marginVertical: 16 },
  avatarWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: palette.primary,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPrompt: { fontSize: 13, color: palette.muted, textAlign: 'center', marginHorizontal: 20, marginBottom: 16 },
  photoButtonRow: { flexDirection: 'row', gap: 12 },
  photoBtn: { minWidth: 130 },
  permHeader: { flexDirection: 'row', alignItems: 'center' },
  permTitle: { fontSize: 15, fontWeight: '700', color: palette.ink },
  permDesc: { fontSize: 12, color: palette.muted, marginTop: 2, lineHeight: 17 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 6, gap: 10 },
  summaryText: { fontSize: 13, color: palette.ink, fontWeight: '500', flex: 1 },
  buttonContainer: { marginTop: 20 },
  stepButtonRow: { flexDirection: 'row', gap: 12 },
  halfBtn: { flex: 1 },
  fullBtn: { width: '100%' },
  logoutBtn: { padding: 12, alignItems: 'center', marginTop: 12 },
  logoutText: { color: palette.muted, fontSize: 13, fontWeight: '500' },
});
