import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Card, Chip, Divider, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../api/notificationApi';
import type { AppNotification } from '../api/notificationApi';
import {
  submitSpecialWorkingHoursRequest,
  getEmployeeExceptions,
  cancelAttendanceException,
} from '../api/attendanceApi';
import type { AttendanceExceptionItem } from '../api/attendanceApi';
import { getHrStaff, HrStaffMember } from '../api/employeeApi';
import { ScreenHeader } from '../components/ScreenHeader';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { palette } from '../theme/theme';

interface GroupedNotifications {
  title: string;
  data: AppNotification[];
}

function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { user, employeeProfile } = useAuth();

  // Tab state: 'notifications' | 'msg_to_hr'
  const [activeTab, setActiveTab] = useState<'notifications' | 'msg_to_hr'>('notifications');

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Msg to HR form state
  const [hrStaffList, setHrStaffList] = useState<HrStaffMember[]>([]);
  const [selectedHrEmail, setSelectedHrEmail] = useState('priya.patil@company.com');
  const [customHrEmail, setCustomHrEmail] = useState('');
  const [useCustomHrEmail, setUseCustomHrEmail] = useState(false);
  const [requestDate, setRequestDate] = useState(() => getTodayDateStr());
  const [additionalHours, setAdditionalHours] = useState('2');
  const [reason, setReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Request History state
  const [exceptionHistory, setExceptionHistory] = useState<AttendanceExceptionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  const recipientId = employeeProfile?.id || user?.id || '';
  const employeeId = employeeProfile?.employeeCode || employeeProfile?.id || user?.id || '';
  const employeeName = employeeProfile
    ? `${employeeProfile.firstName} ${employeeProfile.lastName}`.trim()
    : user?.fullName || 'Employee';
  const employeeEmail = employeeProfile?.email || user?.email || '';

  // 1. Load Notifications
  const loadNotifications = useCallback(async () => {
    if (!recipientId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    try {
      const res = await getNotifications({
        recipientId,
        limit: 50,
      });
      setNotifications(res.items || []);
    } catch {
      setError('Unable to load notifications. Please check your network connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [recipientId]);

  // 2. Load HR staff list
  const loadHrStaff = useCallback(async () => {
    try {
      const staff = await getHrStaff();
      setHrStaffList(staff);
      if (staff.length > 0 && !selectedHrEmail) {
        setSelectedHrEmail(staff[0].email);
      }
    } catch {
      // Keep defaults
    }
  }, [selectedHrEmail]);

  // 3. Load Employee Exception History
  const loadExceptionHistory = useCallback(async () => {
    if (!employeeId) return;
    setLoadingHistory(true);
    try {
      const history = await getEmployeeExceptions(employeeId);
      // Sort newest first
      const sorted = [...history].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setExceptionHistory(sorted);
    } catch {
      // Non-fatal
    } finally {
      setLoadingHistory(false);
      setRefreshingHistory(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadNotifications();
    loadHrStaff();
  }, [loadNotifications, loadHrStaff]);

  useEffect(() => {
    if (activeTab === 'msg_to_hr') {
      loadExceptionHistory();
    }
  }, [activeTab, loadExceptionHistory]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleRefreshHistory = useCallback(() => {
    setRefreshingHistory(true);
    loadExceptionHistory();
  }, [loadExceptionHistory]);

  const handleMarkAsRead = async (item: AppNotification) => {
    if (item.isRead) return;
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      await markNotificationAsRead(item.id);
    } catch {
      await loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    if (!recipientId) return;
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await markAllNotificationsAsRead(recipientId);
    } catch {
      await loadNotifications();
    }
  };

  // Submit Special Working Hours Request
  const handleSubmitSpecialRequest = async () => {
    setRequestError(null);
    setRequestSuccess(null);

    const targetHrEmail = useCustomHrEmail ? customHrEmail.trim().toLowerCase() : selectedHrEmail.trim().toLowerCase();
    if (!targetHrEmail || !targetHrEmail.includes('@')) {
      setRequestError('Please select or provide a valid HR email address.');
      return;
    }

    if (!requestDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestDate.trim())) {
      setRequestError('Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    const hours = parseFloat(additionalHours);
    if (isNaN(hours) || hours <= 0) {
      setRequestError('Additional hours must be a positive number greater than 0.');
      return;
    }

    if (hours > 12) {
      setRequestError('Additional hours cannot exceed 12 hours in a single request.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setRequestError('Please explain your genuine situation/reason (at least 5 characters).');
      return;
    }

    setSubmittingRequest(true);
    try {
      await submitSpecialWorkingHoursRequest({
        employeeId,
        attendanceDate: requestDate.trim(),
        additionalHours: hours,
        reason: reason.trim(),
        hrEmail: targetHrEmail,
        metadata: {
          employeeName,
          employeeEmail,
          employeeId,
          dateStr: requestDate.trim(),
        },
      });

      setRequestSuccess(
        `Your request for +${hours}h on ${requestDate.trim()} has been sent to HR (${targetHrEmail}). You will receive a notification once HR reviews it.`,
      );
      setReason('');
      // Reload history immediately
      await loadExceptionHistory();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (err?.response?.status === 409
          ? 'A pending special working-hours request already exists for this date. Please check your Request History below or wait for HR to review it.'
          : err?.message || 'Failed to submit special working-hours request. Please try again.');
      setRequestError(msg);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    try {
      await cancelAttendanceException(id);
      setRequestSuccess('Request cancelled. You can now submit an updated request if needed.');
      await loadExceptionHistory();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Could not cancel request.';
      setRequestError(msg);
    }
  };

  // Group notifications into Today, Yesterday, and Older
  const groupNotifications = (items: AppNotification[]): GroupedNotifications[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayItems: AppNotification[] = [];
    const yesterdayItems: AppNotification[] = [];
    const olderItems: AppNotification[] = [];

    items.forEach((item) => {
      const itemDate = new Date(item.createdAt);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate.getTime() === today.getTime()) {
        todayItems.push(item);
      } else if (itemDate.getTime() === yesterday.getTime()) {
        yesterdayItems.push(item);
      } else {
        olderItems.push(item);
      }
    });

    const groups: GroupedNotifications[] = [];
    if (todayItems.length > 0) groups.push({ title: 'TODAY', data: todayItems });
    if (yesterdayItems.length > 0) groups.push({ title: 'YESTERDAY', data: yesterdayItems });
    if (olderItems.length > 0) groups.push({ title: 'EARLIER', data: olderItems });

    return groups;
  };

  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const d = new Date(isoString);
      d.setHours(0, 0, 0, 0);

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (d.getTime() === today.getTime()) {
        return timeStr;
      }

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.getTime() === yesterday.getTime()) {
        return `Yesterday, ${timeStr}`;
      }

      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch {
      return '';
    }
  };

  const getVisualType = (item: AppNotification) => {
    const typeUpper = (item.type || '').toUpperCase();
    if (typeUpper.includes('SPECIAL') || typeUpper.includes('ADJUSTMENT')) {
      if (typeUpper.includes('APPROVED')) {
        return {
          icon: 'star-circle' as const,
          color: '#16A34A',
          bg: '#F0FDF4',
          borderColor: '#BBF7D0',
          tag: 'Special Approved',
        };
      }
      if (typeUpper.includes('REJECTED')) {
        return {
          icon: 'close-circle' as const,
          color: palette.error,
          bg: '#FEF2F2',
          borderColor: '#FECACA',
          tag: 'Special Rejected',
        };
      }
      return {
        icon: 'clock-star-four-points' as const,
        color: '#7C3AED',
        bg: '#F5F3FF',
        borderColor: '#DDD6FE',
        tag: 'Special Hours',
      };
    }

    if (
      typeUpper.includes('CHECKIN') ||
      typeUpper.includes('CHECKOUT') ||
      typeUpper.includes('CHECK_IN') ||
      typeUpper.includes('CHECK_OUT') ||
      typeUpper.includes('APPROVED')
    ) {
      if (typeUpper.includes('AUTO')) {
        return {
          icon: 'alert-circle' as const,
          color: '#D97706',
          bg: '#FFFBEB',
          borderColor: '#FDE68A',
          tag: 'Automatic',
        };
      }
      return {
        icon: 'check-circle' as const,
        color: palette.success,
        bg: '#F0FDF4',
        borderColor: '#BBF7D0',
        tag: 'Attendance',
      };
    }

    if (
      typeUpper.includes('REMINDER') ||
      typeUpper.includes('WARNING') ||
      typeUpper.includes('LATE') ||
      typeUpper.includes('EXIT')
    ) {
      return {
        icon: 'clock-alert-outline' as const,
        color: '#D97706',
        bg: '#FFFBEB',
        borderColor: '#FDE68A',
        tag: 'Alert',
      };
    }

    if (
      typeUpper.includes('OUTSIDE') ||
      typeUpper.includes('ERROR') ||
      typeUpper.includes('REJECTED') ||
      typeUpper.includes('ISSUE')
    ) {
      return {
        icon: 'alert-octagon' as const,
        color: palette.error,
        bg: '#FEF2F2',
        borderColor: '#FECACA',
        tag: 'Attention',
      };
    }

    return {
      icon: 'information-outline' as const,
      color: palette.primary,
      bg: '#EFF6FF',
      borderColor: '#BFDBFE',
      tag: 'Notice',
    };
  };

  const groups = groupNotifications(notifications);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <ScreenHeader
        title="Notifications & HR"
        onBack={() => navigation.goBack()}
        rightAction={
          activeTab === 'notifications' && unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Segmented Tab Bar */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'notifications' && styles.tabButtonActive]}
          onPress={() => setActiveTab('notifications')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="bell-outline"
            size={18}
            color={activeTab === 'notifications' ? palette.primary : '#64748B'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'notifications' && styles.tabButtonTextActive]}
          >
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'msg_to_hr' && styles.tabButtonActive]}
          onPress={() => setActiveTab('msg_to_hr')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="message-text-clock-outline"
            size={18}
            color={activeTab === 'msg_to_hr' ? palette.primary : '#64748B'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'msg_to_hr' && styles.tabButtonTextActive]}
          >
            Msg to HR
          </Text>
          <View style={styles.specialPill}>
            <Text style={styles.specialPillText}>Hours</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* TAB 1: NOTIFICATIONS FEED */}
      {activeTab === 'notifications' && (
        <>
          {loading && !refreshing ? (
            <LoadingIndicator message="Checking notifications..." />
          ) : error ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={palette.error} />
              <Text style={styles.emptyTitle}>Something went wrong</Text>
              <Text style={styles.emptySubtitle}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadNotifications}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="bell-outline" size={44} color={palette.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up with your attendance updates.</Text>
            </View>
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(item) => item.title}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[palette.primary]}
                />
              }
              renderItem={({ item: group }) => (
                <View style={styles.groupSection}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.data.map((notification) => {
                    const visual = getVisualType(notification);
                    return (
                      <TouchableOpacity
                        key={notification.id}
                        activeOpacity={0.8}
                        onPress={() => handleMarkAsRead(notification)}
                      >
                        <Card
                          style={[
                            styles.notificationCard,
                            !notification.isRead && styles.unreadCard,
                          ]}
                          mode="outlined"
                        >
                          <Card.Content style={styles.cardContent}>
                            <View style={styles.cardHeaderRow}>
                              <View style={styles.headerLeft}>
                                <View
                                  style={[
                                    styles.iconWrap,
                                    { backgroundColor: visual.bg, borderColor: visual.borderColor },
                                  ]}
                                >
                                  <MaterialCommunityIcons
                                    name={visual.icon}
                                    size={18}
                                    color={visual.color}
                                  />
                                </View>
                                <Text style={styles.notificationTitle} numberOfLines={1}>
                                  {notification.title}
                                </Text>
                              </View>

                              <View style={styles.headerRight}>
                                {!notification.isRead && <View style={styles.unreadDot} />}
                                <Text style={styles.timeText}>
                                  {formatTimestamp(notification.createdAt)}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.notificationBody}>
                              {notification.body}
                            </Text>

                            {notification.metadata?.reason ? (
                              <View style={styles.reasonTag}>
                                <Text style={styles.reasonText}>
                                  Reason: {String(notification.metadata.reason)}
                                </Text>
                              </View>
                            ) : null}
                          </Card.Content>
                        </Card>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          )}
        </>
      )}

      {/* TAB 2: MSG TO HR — SPECIAL CONDITION WORKING HOURS */}
      {activeTab === 'msg_to_hr' && (
        <ScrollView
          contentContainerStyle={styles.msgToHrContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHistory}
              onRefresh={handleRefreshHistory}
              colors={[palette.primary]}
            />
          }
        >
          {/* Header Banner */}
          <Card style={styles.formCard} mode="elevated">
            <Card.Content style={{ padding: 16 }}>
              <View style={styles.formHeaderRow}>
                <View style={styles.formHeaderIconWrap}>
                  <MaterialCommunityIcons name="clock-plus-outline" size={24} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formHeaderTitle}>Special Condition Working Hours</Text>
                  <Text style={styles.formHeaderSubtitle}>
                    Have a genuine situation requiring additional hours? Send a request to HR for approval.
                  </Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 14 }} />

              {/* Success Banner */}
              {requestSuccess ? (
                <View style={styles.successBanner}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#16A34A" />
                  <Text style={styles.successBannerText}>{requestSuccess}</Text>
                </View>
              ) : null}

              {/* Error Banner */}
              {requestError ? (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{requestError}</Text>
                </View>
              ) : null}

              {/* Form Input 1: HR Recipient */}
              <Text style={styles.fieldLabel}>Send Request to HR Email *</Text>
              {!useCustomHrEmail ? (
                <View style={styles.hrChipsRow}>
                  {hrStaffList.map((hr) => {
                    const isSelected = selectedHrEmail.toLowerCase() === hr.email.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={hr.email}
                        style={[styles.hrChip, isSelected && styles.hrChipSelected]}
                        onPress={() => setSelectedHrEmail(hr.email)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={isSelected ? 'account-check' : 'account-outline'}
                          size={16}
                          color={isSelected ? '#7C3AED' : '#64748B'}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.hrChipName, isSelected && styles.hrChipNameSelected]}>
                            {hr.name}
                          </Text>
                          <Text style={[styles.hrChipEmail, isSelected && styles.hrChipEmailSelected]}>
                            {hr.email}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.customEmailToggle}
                    onPress={() => setUseCustomHrEmail(true)}
                  >
                    <Text style={styles.customEmailToggleText}>+ Enter different HR email</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="email-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <RNTextInput
                      style={styles.textInput}
                      placeholder="e.g. hr@company.com"
                      placeholderTextColor="#94A3B8"
                      value={customHrEmail}
                      onChangeText={setCustomHrEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.customEmailToggle}
                    onPress={() => setUseCustomHrEmail(false)}
                  >
                    <Text style={styles.customEmailToggleText}>← Select from known HR staff</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Form Input 2: Attendance Date */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Applicable Date (YYYY-MM-DD) *</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <RNTextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                  value={requestDate}
                  onChangeText={setRequestDate}
                  maxLength={10}
                />
              </View>
              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  style={[styles.quickDateChip, requestDate === getTodayDateStr() && styles.quickDateChipActive]}
                  onPress={() => setRequestDate(getTodayDateStr())}
                >
                  <Text style={[styles.quickDateText, requestDate === getTodayDateStr() && styles.quickDateTextActive]}>
                    Today ({getTodayDateStr()})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickDateChip, requestDate === getYesterdayDateStr() && styles.quickDateChipActive]}
                  onPress={() => setRequestDate(getYesterdayDateStr())}
                >
                  <Text style={[styles.quickDateText, requestDate === getYesterdayDateStr() && styles.quickDateTextActive]}>
                    Yesterday ({getYesterdayDateStr()})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Input 3: Additional Working Hours */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Additional Hours Requested *</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="timer-plus-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
                <RNTextInput
                  style={styles.textInput}
                  placeholder="e.g. 2 or 1.5"
                  placeholderTextColor="#94A3B8"
                  value={additionalHours}
                  onChangeText={setAdditionalHours}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>Hours</Text>
              </View>
              <View style={styles.quickHoursRow}>
                {['1', '1.5', '2', '2.5', '3', '4'].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.quickHourChip, additionalHours === h && styles.quickHourChipActive]}
                    onPress={() => setAdditionalHours(h)}
                  >
                    <Text style={[styles.quickHourText, additionalHours === h && styles.quickHourTextActive]}>
                      +{h}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Form Input 4: Message / Genuine Situation Reason */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Message / Genuine Situation Reason *</Text>
              <View style={[styles.inputWrap, { height: 90, alignItems: 'flex-start', paddingTop: 8 }]}>
                <RNTextInput
                  style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Describe your genuine situation (e.g. Server migration issue delayed until midnight, critical client escalation onsite, etc.)..."
                  placeholderTextColor="#94A3B8"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, submittingRequest && styles.submitBtnDisabled]}
                onPress={handleSubmitSpecialRequest}
                disabled={submittingRequest}
                activeOpacity={0.8}
              >
                {submittingRequest ? (
                  <ActivityIndicator color="#FFFFFF" size={20} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Send Request to HR</Text>
                  </>
                )}
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* REQUEST HISTORY SECTION */}
          <View style={styles.historySectionHeader}>
            <Text style={styles.historyHeading}>Employee Request History</Text>
            <TouchableOpacity onPress={handleRefreshHistory}>
              <MaterialCommunityIcons name="refresh" size={20} color={palette.primary} />
            </TouchableOpacity>
          </View>

          {loadingHistory && !refreshingHistory ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={palette.primary} />
          ) : exceptionHistory.length === 0 ? (
            <Card style={styles.emptyHistoryCard} mode="outlined">
              <Card.Content style={{ alignItems: 'center', padding: 24 }}>
                <MaterialCommunityIcons name="file-document-outline" size={36} color="#94A3B8" />
                <Text style={styles.emptyHistoryTitle}>No Requests Yet</Text>
                <Text style={styles.emptyHistorySubtitle}>
                  Your submitted special condition working hours requests will appear here with their approval status.
                </Text>
              </Card.Content>
            </Card>
          ) : (
            exceptionHistory.map((item) => {
              const meta = item.metadata || {};
              const reqHours = meta.additionalHours ?? (meta.additionalMinutes ? meta.additionalMinutes / 60 : 0);
              const targetHr = meta.hrEmail || 'HR';
              const dateOnly = item.attendanceDate ? String(item.attendanceDate).slice(0, 10) : '';

              const isApproved = item.status === 'APPROVED';
              const isRejected = item.status === 'REJECTED';
              const isPending = item.status === 'PENDING';

              return (
                <Card key={item.id} style={styles.historyCard} mode="outlined">
                  <Card.Content style={{ padding: 14 }}>
                    <View style={styles.historyCardHeader}>
                      <View>
                        <Text style={styles.historyCardDate}>{dateOnly}</Text>
                        <Text style={styles.historyCardHours}>
                          Requested: +{reqHours} hours
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          isApproved && styles.statusBadgeApproved,
                          isRejected && styles.statusBadgeRejected,
                          isPending && styles.statusBadgePending,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            isApproved
                              ? 'check-circle'
                              : isRejected
                              ? 'close-circle'
                              : 'clock-outline'
                          }
                          size={14}
                          color={
                            isApproved
                              ? '#16A34A'
                              : isRejected
                              ? '#DC2626'
                              : '#D97706'
                          }
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isApproved && styles.statusBadgeTextApproved,
                            isRejected && styles.statusBadgeTextRejected,
                            isPending && styles.statusBadgeTextPending,
                          ]}
                        >
                          {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending Review'}
                        </Text>
                      </View>
                    </View>

                    <Divider style={{ marginVertical: 10 }} />

                    <Text style={styles.historyCardReason}>
                      "{item.reason}"
                    </Text>

                    <View style={styles.historyCardFooter}>
                      <Text style={styles.historyCardHr}>
                        Target HR: {targetHr}
                      </Text>
                      {isPending ? (
                        <TouchableOpacity
                          onPress={() => handleCancelRequest(item.id)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            backgroundColor: '#FEE2E2',
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '700' }}>Cancel</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.historyCardTime}>
                          {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  markAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: palette.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: palette.primary,
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: palette.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  specialPill: {
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  specialPillText: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  groupSection: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  notificationCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 12,
    marginBottom: 8,
  },
  unreadCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D2FE',
    borderWidth: 1.5,
  },
  cardContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
    marginRight: 6,
  },
  timeText: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '500',
  },
  notificationBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  reasonTag: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reasonText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: palette.primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  // Msg to HR tab styles
  msgToHrContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  formHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
    marginBottom: 3,
  },
  formHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  successBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  hrChipsRow: {
    gap: 8,
  },
  hrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  hrChipSelected: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
    borderWidth: 1.5,
  },
  hrChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  hrChipNameSelected: {
    color: '#7C3AED',
  },
  hrChipEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  hrChipEmailSelected: {
    color: '#6D28D9',
  },
  customEmailToggle: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  customEmailToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: palette.ink,
    padding: 0,
  },
  inputSuffix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quickDateChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickDateChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: palette.primary,
  },
  quickDateText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  quickDateTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  quickHoursRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quickHourChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickHourChipActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
    borderWidth: 1.5,
  },
  quickHourText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  quickHourTextActive: {
    color: '#7C3AED',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 18,
  },
  submitBtnDisabled: {
    backgroundColor: '#A78BFA',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  historySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  historyHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.ink,
  },
  emptyHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderColor: '#E2E8F0',
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyHistorySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyCardDate: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.ink,
  },
  historyCardHours: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusBadgeRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextPending: {
    color: '#B45309',
  },
  statusBadgeTextApproved: {
    color: '#15803D',
  },
  statusBadgeTextRejected: {
    color: '#B91C1C',
  },
  historyCardReason: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  historyCardHr: {
    fontSize: 11,
    color: '#64748B',
  },
  historyCardTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
