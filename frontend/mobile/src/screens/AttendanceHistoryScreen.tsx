import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, Chip, Divider, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getAttendanceHistory } from '../api/attendanceApi';
import type { AttendanceSession } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ErrorMessage } from '../components/ErrorMessage';
import { ScreenHeader } from '../components/ScreenHeader';
import { palette } from '../theme/theme';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function AttendanceHistoryScreen() {
  const navigation = useNavigation();
  const { employeeProfile, user } = useAuth();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const empId = employeeProfile?.employeeCode || employeeProfile?.id || user?.id;
      const records = await getAttendanceHistory(empId, 30);
      setSessions(records);
    } catch (err: unknown) {
      console.warn('Failed to load attendance history:', err);
      setError('Unable to load attendance history. Please check connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeProfile?.employeeCode, employeeProfile?.id, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const renderItem = ({ item }: { item: AttendanceSession }) => {
    const isWorking = item.status === 'WORKING';
    const isPaused = item.status === 'PAUSED';
    const isLate = item.checkInStatus === 'LATE';

    return (
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.rowBetween}>
            <Text style={styles.dateText}>
              {item.attendanceDate ? String(item.attendanceDate).slice(0, 10) : 'Date N/A'}
            </Text>
            <View style={styles.chipRow}>
              {isLate && (
                <Chip textStyle={styles.chipText} style={styles.lateChip}>
                  Late
                </Chip>
              )}
              <Chip
                textStyle={[
                  styles.chipText,
                  isWorking && { color: '#2E7D32', fontWeight: '700' },
                  isPaused && { color: '#B78103', fontWeight: '700' },
                ]}
                style={[
                  styles.statusChip,
                  isWorking && { backgroundColor: '#E8F5E9' },
                  isPaused && { backgroundColor: '#FEF3C7' },
                ]}
              >
                {item.status.replace('_', ' ')}
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.grid}>
            <View style={styles.col}>
              <Text style={styles.label}>Check In</Text>
              <Text style={styles.val}>{formatTime(item.checkInAt)}</Text>
            </View>

            <View style={styles.col}>
              <Text style={styles.label}>Check Out</Text>
              <Text style={styles.val}>{formatTime(item.checkOutAt)}</Text>
            </View>

            <View style={styles.col}>
              <Text style={styles.label}>Total Worked</Text>
              <Text style={[styles.val, styles.durationVal]}>
                {formatDuration(item.totalWorkingSeconds)}
              </Text>
            </View>
          </View>

          {Boolean(
            item.hasSpecialCondition ||
              (item.specialConditionSeconds && item.specialConditionSeconds > 0),
          ) && (
            <View style={styles.specialConditionRow}>
              <View style={styles.specialConditionBadge}>
                <Text style={styles.specialConditionBadgeText}>
                  +{formatDuration(item.specialConditionSeconds || 0)} Special Condition (HR Approved)
                </Text>
              </View>
              {Boolean(item.specialConditionReason) && (
                <Text style={styles.specialConditionReason}>
                  "{item.specialConditionReason}"
                </Text>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Attendance History"
        onBack={() => navigation.goBack()}
      />

      <ErrorMessage message={error} />

      {loading && !refreshing ? (
        <LoadingIndicator message="Loading your attendance records..." />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No Attendance Records</Text>
              <Text style={styles.emptySub}>
                Your check-in and check-out logs will appear here once recorded.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: { padding: 4 },
  backText: { color: palette.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: palette.ink },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: { fontSize: 15, fontWeight: '700', color: palette.ink },
  chipRow: { flexDirection: 'row', gap: 6 },
  chipText: { fontSize: 11 },
  lateChip: { backgroundColor: '#FFF3E0' },
  statusChip: { backgroundColor: '#ECEFF1' },
  divider: { marginVertical: 12 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1 },
  label: { fontSize: 11, color: palette.muted, textTransform: 'uppercase', marginBottom: 2 },
  val: { fontSize: 14, fontWeight: '600', color: palette.ink },
  durationVal: { color: palette.primary, fontWeight: '700' },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: palette.muted, textAlign: 'center' },
  specialConditionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  specialConditionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  specialConditionBadgeText: {
    color: '#6D28D9',
    fontSize: 11,
    fontWeight: '700',
  },
  specialConditionReason: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
