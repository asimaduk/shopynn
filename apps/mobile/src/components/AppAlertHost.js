import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import useTheme from '../hooks/useTheme';
import { dismissAppAlert, subscribeAppAlerts } from '../utils/appAlert';

const ERROR_RE =
  /(fail|error|could ?n[o']t|cannot|can't|invalid|denied|unable|not allowed|expired|too many|insufficient|not found|unavailable|offline|no internet)/i;
const SUCCESS_RE =
  /\b(saved|success|successful|successfully|done|sent|uploaded|created|updated|added|collected|copied|completed|confirmed|recorded|approved|verified|welcome|submitted|restored|removed|deleted|cancelled|paid)\b/i;
const WARNING_RE =
  /\b(required|missing|warning|check|too much|too high|too low|limit|empty|select|choose|enter)\b/i;

const toneFor = alert => {
  const text = alert.title || alert.message;
  const hasDestructive = alert.buttons.some(b => b.style === 'destructive');
  const isQuestion = alert.buttons.length > 1;
  if (hasDestructive) return { icon: 'triangle-alert', tone: 'destructive' };
  if (ERROR_RE.test(text)) return { icon: 'circle-x', tone: 'error' };
  if (isQuestion) return { icon: 'circle-help', tone: 'primary' };
  if (SUCCESS_RE.test(alert.title))
    return { icon: 'circle-check', tone: 'success' };
  if (WARNING_RE.test(text)) return { icon: 'circle-alert', tone: 'warning' };
  return { icon: 'info', tone: 'primary' };
};

/**
 * Renders queued AppAlert dialogs as an overlay (not a native Modal). Mount one at the app root and
 * one inside every native Modal so alerts raised from a sheet appear above it.
 */
const AppAlertHost = () => {
  const { colors, isDark } = useTheme();
  const [alert, setAlert] = useState(null);
  const alertRef = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => subscribeAppAlerts(setAlert), []);

  alertRef.current = alert;

  useEffect(() => {
    if (!alert) return;
    Keyboard.dismiss();
    fade.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [alert?.id, fade, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = action => {
    const current = alertRef.current;
    if (!current) return;
    dismissAppAlert(current.id);
    if (action) action();
  };

  const handlePress = button => finish(button.onPress);

  const handleBackdrop = () => {
    const current = alertRef.current;
    if (!current) return;
    const cancel = current.buttons.find(b => b.style === 'cancel');
    if (cancel) {
      finish(cancel.onPress);
    } else if (current.options?.cancelable) {
      finish(current.options.onDismiss);
    }
  };

  useEffect(() => {
    if (!alert) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackdrop();
      return true;
    });
    return () => sub.remove();
  }, [alert?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alert) return null;

  const { icon, tone } = toneFor(alert);
  const primary = colors.primary || '#0A74DA';
  const danger = colors.error || '#dc2626';
  const iconColor = {
    destructive: danger,
    error: danger,
    success: colors.success || '#10b981',
    warning: colors.warning || '#f59e0b',
    primary,
  }[tone];
  const iconBg = {
    destructive: colors.errorLight || 'rgba(220,38,38,0.12)',
    error: colors.errorLight || 'rgba(220,38,38,0.12)',
    success: isDark
      ? 'rgba(16,185,129,0.18)'
      : colors.successLight || '#d1fae5',
    warning: isDark
      ? 'rgba(245,158,11,0.18)'
      : colors.warningLight || '#fef3c7',
    primary: colors.primaryShade || 'rgba(10,116,218,0.12)',
  }[tone];

  const buttons = alert.buttons;
  const stacked = buttons.length > 2;
  let ordered = buttons;
  if (
    buttons.length === 2 &&
    buttons[1].style === 'cancel' &&
    buttons[0].style !== 'cancel'
  ) {
    ordered = [buttons[1], buttons[0]];
  }
  if (stacked) {
    ordered = [
      ...buttons.filter(b => b.style !== 'cancel'),
      ...buttons.filter(b => b.style === 'cancel'),
    ];
  }
  const primaryIndex = stacked ? 0 : ordered.length - 1;

  const renderButton = (button, index) => {
    const isCancel = button.style === 'cancel';
    const isPrimary = !isCancel && index === primaryIndex;
    const isDestructive = button.style === 'destructive';
    const filled = isPrimary || (isDestructive && !stacked);
    const fill = isDestructive ? danger : primary;
    return (
      <TouchableOpacity
        key={`${button.text}-${index}`}
        activeOpacity={0.75}
        onPress={() => handlePress(button)}
        style={[
          styles.btn,
          stacked ? styles.btnStacked : styles.btnRow,
          filled
            ? { backgroundColor: fill }
            : {
                backgroundColor: colors.surfaceSecondary || colors.background,
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
              },
        ]}
      >
        <AppText
          label={button.text}
          variant={1}
          fontSize={15}
          color={filled ? '#fff' : isDestructive ? danger : colors.text}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdrop} />
      </Animated.View>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : 'rgba(15, 23, 42, 0.06)',
            opacity: fade,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Lucide name={icon} size={26} color={iconColor} />
        </View>
        {alert.title ? (
          <AppText
            label={alert.title}
            variant={1}
            fontSize={18}
            color={colors.text}
            style={styles.title}
          />
        ) : null}
        {alert.message ? (
          <AppText
            label={alert.message}
            fontSize={14}
            color={colors.textSecondary}
            style={styles.message}
          />
        ) : null}
        <View style={stacked ? styles.actionsStacked : styles.actionsRow}>
          {ordered.map(renderButton)}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { textAlign: 'center', marginBottom: 6 },
  message: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  actionsRow: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 16 },
  actionsStacked: { width: '100%', gap: 10, marginTop: 16 },
  btn: {
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnRow: { flex: 1 },
  btnStacked: { width: '100%' },
});

export default AppAlertHost;
