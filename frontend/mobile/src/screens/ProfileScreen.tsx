import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  Card,
  Divider,
  IconButton,
  Snackbar,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { updateEmployeeMe } from '../api/employeeApi';
import type { UpdateEmployeeProfileInput } from '../api/employeeApi';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { AppTextInput } from '../components/AppTextInput';
import { ErrorMessage } from '../components/ErrorMessage';
import { palette } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, employeeProfile, refreshProfile } = useAuth();

  // Edit Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');

  // Snackbar feedback
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  // Open Edit Modal with current values
  const handleOpenEdit = () => {
    setFirstName(employeeProfile?.firstName || '');
    setLastName(employeeProfile?.lastName || '');
    setPersonalEmail(employeeProfile?.personalEmail || '');
    setPhone(employeeProfile?.phone || '');
    setDateOfBirth(
      employeeProfile?.dateOfBirth ? String(employeeProfile.dateOfBirth).slice(0, 10) : '',
    );
    setAddress(employeeProfile?.address || '');
    setEditError(null);
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    // Basic validation
    if (!firstName.trim()) {
      setEditError('First name is required.');
      return;
    }

    if (personalEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(personalEmail.trim())) {
        setEditError('Please enter a valid personal email address.');
        return;
      }
    }

    setSaving(true);
    setEditError(null);

    try {
      const payload: UpdateEmployeeProfileInput = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        personalEmail: personalEmail.trim() || null,
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || null,
        address: address.trim() || null,
      };

      await updateEmployeeMe(payload);
      await refreshProfile();

      setIsEditModalVisible(false);
      setSnackbarMessage('Profile updated successfully');
    } catch (err: unknown) {
      setEditError(getErrorMessage(err, 'Failed to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

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

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(isoString);
    }
  };

  const fullName = employeeProfile?.firstName
    ? `${employeeProfile.firstName} ${employeeProfile.lastName || ''}`.trim()
    : user?.fullName || 'Employee';

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Employee Profile"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Profile Card */}
        <Card style={styles.headerCard} mode="elevated">
          <Card.Content style={styles.headerCardContent}>
            <Avatar.Text
              size={80}
              label={getInitials()}
              style={styles.avatar}
              labelStyle={styles.avatarLabel}
            />

            <Text style={styles.nameText}>{fullName}</Text>
            <Text style={styles.jobText}>{employeeProfile?.jobTitle || 'Team Member'}</Text>
            <Text style={styles.deptText}>
              {employeeProfile?.department?.name || 'Operations'}
            </Text>

            {employeeProfile?.employeeCode ? (
              <View style={styles.badgeRow}>
                <View style={styles.idBadge}>
                  <Text style={styles.idBadgeLabel}>EMPLOYEE ID</Text>
                  <Text style={styles.idBadgeValue}>{employeeProfile.employeeCode}</Text>
                </View>
              </View>
            ) : null}
          </Card.Content>
        </Card>

        {/* 1. PERSONAL INFORMATION SECTION */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <MaterialCommunityIcons name="account-circle-outline" size={20} color={palette.primary} />
            <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={handleOpenEdit}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pencil-outline" size={15} color={palette.primary} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.infoCard} mode="outlined">
          <Card.Content style={styles.infoCardContent}>
            <InfoRow label="Full Name" value={fullName} icon="account" />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Personal Email"
              value={employeeProfile?.personalEmail || '—'}
              icon="email-outline"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Phone Number"
              value={employeeProfile?.phone || '—'}
              icon="phone-outline"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Date of Birth"
              value={formatDate(employeeProfile?.dateOfBirth)}
              icon="calendar-account"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Gender"
              value={
                employeeProfile?.gender
                  ? employeeProfile.gender.replace(/_/g, ' ')
                  : '—'
              }
              icon="gender-male-female"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Address"
              value={employeeProfile?.address || '—'}
              icon="map-marker-outline"
            />
          </Card.Content>
        </Card>

        {/* 2. EMPLOYMENT INFORMATION SECTION */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <MaterialCommunityIcons name="briefcase-outline" size={20} color={palette.primary} />
            <Text style={styles.sectionTitle}>EMPLOYMENT INFORMATION</Text>
          </View>
          <View style={styles.readOnlyTag}>
            <MaterialCommunityIcons name="lock-outline" size={13} color={palette.muted} />
            <Text style={styles.readOnlyText}>Official Record</Text>
          </View>
        </View>

        <Card style={styles.infoCard} mode="outlined">
          <Card.Content style={styles.infoCardContent}>
            <InfoRow
              label="Employee ID"
              value={employeeProfile?.employeeCode || '—'}
              icon="badge-account-outline"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Company Email"
              value={employeeProfile?.email || user?.email || '—'}
              icon="email-check-outline"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Department"
              value={employeeProfile?.department?.name || '—'}
              icon="domain"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Designation"
              value={employeeProfile?.jobTitle || '—'}
              icon="card-account-details-outline"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Target Office"
              value={employeeProfile?.officeLocationName || 'Wakad (PN-001)'}
              icon="office-building"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Joining Date"
              value={formatDate(employeeProfile?.dateOfJoining)}
              icon="calendar-check"
            />
            <Divider style={styles.rowDivider} />
            <InfoRow
              label="Employment Status"
              value={employeeProfile?.status || 'ACTIVE'}
              icon="shield-check-outline"
              valueColor={palette.success}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) setIsEditModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <IconButton
                icon="close"
                size={22}
                disabled={saving}
                onPress={() => setIsEditModalVisible(false)}
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {editError && <ErrorMessage message={editError} />}

              <AppTextInput
                label="First Name *"
                value={firstName}
                onChangeText={setFirstName}
                editable={!saving}
              />

              <AppTextInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                editable={!saving}
              />

              <AppTextInput
                label="Personal Email"
                value={personalEmail}
                onChangeText={setPersonalEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!saving}
              />

              <AppTextInput
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!saving}
              />

              <AppTextInput
                label="Date of Birth (YYYY-MM-DD)"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="e.g. 1998-05-15"
                editable={!saving}
              />

              <AppTextInput
                label="Address"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
                editable={!saving}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsEditModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <AppButton
                  onPress={handleSaveProfile}
                  loading={saving}
                  disabled={saving}
                  style={styles.saveBtn}
                >
                  Save Changes
                </AppButton>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Non-intrusive Snackbar Feedback */}
      <Snackbar
        visible={Boolean(snackbarMessage)}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3500}
        style={styles.snackbar}
      >
        <Text style={styles.snackbarText}>{snackbarMessage}</Text>
      </Snackbar>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <MaterialCommunityIcons name={icon} size={18} color={palette.muted} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[styles.infoValue, valueColor ? { color: valueColor } : null]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 3,
  },
  headerCardContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    backgroundColor: palette.primary,
    marginBottom: 12,
  },
  avatarLabel: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  jobText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.primary,
    textAlign: 'center',
  },
  deptText: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  idBadge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  idBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.muted,
    letterSpacing: 0.5,
  },
  idBadgeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    letterSpacing: 0.8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  readOnlyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readOnlyText: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoCardContent: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIconWrap: {
    width: 32,
    alignItems: 'flex-start',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: palette.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink,
  },
  rowDivider: {
    backgroundColor: '#F1F5F9',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
  },
  modalScroll: {
    padding: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
  },
  saveBtn: {
    minWidth: 140,
  },
  snackbar: {
    backgroundColor: palette.ink,
    borderRadius: 8,
  },
  snackbarText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
