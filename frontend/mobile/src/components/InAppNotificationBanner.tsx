import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '../theme/theme';

export interface InAppAlertData {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  onPress?: () => void;
}

interface InAppNotificationBannerProps {
  alert: InAppAlertData | null;
  onDismiss: () => void;
  durationMs?: number;
}

export function InAppNotificationBanner({
  alert,
  onDismiss,
  durationMs = 4500,
}: InAppNotificationBannerProps) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alert) {
      // Clear previous timer
      if (timerRef.current) clearTimeout(timerRef.current);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 9,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      timerRef.current = setTimeout(() => {
        dismissWithAnimation();
      }, durationMs);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } else {
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
    }
  }, [alert]);

  const dismissWithAnimation = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!alert) return null;

  const getThemeProps = () => {
    switch (alert.type) {
      case 'success':
        return {
          bg: '#F0FDF4',
          border: '#BBF7D0',
          icon: 'check-circle' as const,
          iconColor: palette.success,
          titleColor: '#166534',
        };
      case 'warning':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          icon: 'alert-circle' as const,
          iconColor: '#D97706',
          titleColor: '#92400E',
        };
      case 'error':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          icon: 'close-circle' as const,
          iconColor: palette.error,
          titleColor: '#991B1B',
        };
      default:
        return {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          icon: 'information' as const,
          iconColor: palette.primary,
          titleColor: '#1E40AF',
        };
    }
  };

  const themeProps = getThemeProps();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (alert.onPress) {
            alert.onPress();
          }
          dismissWithAnimation();
        }}
        style={[
          styles.banner,
          {
            backgroundColor: themeProps.bg,
            borderColor: themeProps.border,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={themeProps.icon}
            size={22}
            color={themeProps.iconColor}
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: themeProps.titleColor }]}>
            {alert.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {alert.message}
          </Text>
        </View>

        <TouchableOpacity
          onPress={dismissWithAnimation}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <MaterialCommunityIcons name="close" size={18} color={palette.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 24,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  iconContainer: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: palette.ink,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
