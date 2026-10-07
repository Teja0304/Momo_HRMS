import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Avatar, Divider, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '../theme/theme';
import type { EmployeeProfile } from '../api/employeeApi';
import type { AuthUser } from '../types/auth';

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigateProfile: () => void;
  onNavigateNotifications: () => void;
  onLogout: () => void;
  user: AuthUser | null;
  employeeProfile: EmployeeProfile | null;
  unreadCount?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.8));

export function ProfileDrawer({
  visible,
  onClose,
  onNavigateProfile,
  onNavigateNotifications,
  onLogout,
  user,
  employeeProfile,
  unreadCount = 0,
}: ProfileDrawerProps) {
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleClose();
        return true;
      });

      return () => backHandler.remove();
    } else {
      slideAnim.setValue(DRAWER_WIDTH);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (callback) {
        // Small delay so drawer is fully dismissed before screen transition
        setTimeout(callback, 50);
      }
    });
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

  const displayName = employeeProfile?.firstName
    ? `${employeeProfile.firstName} ${employeeProfile.lastName || ''}`.trim()
    : user?.fullName || 'Employee';

  const designation = employeeProfile?.jobTitle || 'Team Member';
  const departmentName = employeeProfile?.department?.name || 'Operations';
  const employeeCode = employeeProfile?.employeeCode || '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleClose()}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {/* Subtle Dark Backdrop */}
        <TouchableWithoutFeedback onPress={() => handleClose()}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Sliding Panel */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Top Bar with Title and Close Button */}
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Employee Profile</Text>
            <IconButton
              icon="close"
              size={22}
              iconColor={palette.muted}
              onPress={() => handleClose()}
              style={styles.closeBtn}
            />
          </View>

          {/* Profile Header */}
          <View style={styles.profileSection}>
            <View style={styles.avatarWrap}>
              {employeeProfile?.profilePhotoUrl ? (
                <Avatar.Image
                  size={70}
                  source={{ uri: employeeProfile.profilePhotoUrl }}
                  style={styles.avatar}
                />
              ) : (
                <Avatar.Text
                  size={70}
                  label={getInitials()}
                  style={styles.avatar}
                  labelStyle={styles.avatarLabel}
                />
              )}
              <View style={styles.onlineBadge} />
            </View>

            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.userRole} numberOfLines={1}>
              {designation}
            </Text>
            <Text style={styles.userDept} numberOfLines={1}>
              {departmentName}
            </Text>

            {employeeCode ? (
              <View style={styles.empCodeBadge}>
                <Text style={styles.empCodeText}>{employeeCode}</Text>
              </View>
            ) : null}
          </View>

          <Divider style={styles.divider} />

          {/* Menu Items */}
          <View style={styles.menuContainer}>
            {/* 1. Profile Option */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => handleClose(onNavigateProfile)}
            >
              <View style={styles.menuIconContainer}>
                <MaterialCommunityIcons name="account-outline" size={22} color={palette.primary} />
              </View>
              <Text style={styles.menuLabel}>Profile</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={palette.muted} />
            </TouchableOpacity>

            {/* 2. Notifications Option */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => handleClose(onNavigateNotifications)}
            >
              <View style={styles.menuIconContainer}>
                <MaterialCommunityIcons name="bell-outline" size={22} color={palette.primary} />
              </View>
              <Text style={styles.menuLabel}>Notifications</Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={20} color={palette.muted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Footer with Logout */}
          <View style={styles.footerContainer}>
            <Divider style={styles.divider} />
            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.7}
              onPress={() => handleClose(onLogout)}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEE2E2' }]}>
                <MaterialCommunityIcons name="logout" size={20} color={palette.error} />
              </View>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: palette.surface,
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  closeBtn: {
    margin: 0,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    backgroundColor: palette.primary,
  },
  avatarLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.success,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 3,
  },
  userRole: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.primary,
    textAlign: 'center',
  },
  userDept: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  empCodeBadge: {
    marginTop: 8,
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  empCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: 0.5,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: palette.border,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink,
  },
  unreadBadge: {
    backgroundColor: palette.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  footerContainer: {
    paddingHorizontal: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.error,
  },
});
