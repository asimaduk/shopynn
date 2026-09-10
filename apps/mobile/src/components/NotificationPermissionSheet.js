import React, { useEffect, useRef } from 'react';
import {
	Animated,
	Easing,
	Modal,
	Pressable,
	StyleSheet,
	TouchableOpacity,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import config from '../config';
import useTheme from '../hooks/useTheme';

const BENEFITS = [
	{ icon: 'package-search', label: 'Low stock alerts' },
	{ icon: 'package', label: 'New online orders' },
	{ icon: 'chart-column', label: 'Daily sales summary' },
];

/**
 * Soft permission primer — bottom sheet, not a system Alert.
 */
const NotificationPermissionSheet = ({
	visible,
	title = 'Stay up to date',
	message = 'Get timely alerts for your shop. You can change this anytime in Settings.',
	confirmLabel = 'Enable notifications',
	cancelLabel = 'Not now',
	onConfirm,
	onCancel,
}) => {
	const { colors, isDark } = useTheme();
	const insets = useSafeAreaInsets();
	const slide = useRef(new Animated.Value(40)).current;
	const fade = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!visible) return undefined;
		slide.setValue(48);
		fade.setValue(0);
		Animated.parallel([
			Animated.timing(fade, {
				toValue: 1,
				duration: 220,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}),
			Animated.timing(slide, {
				toValue: 0,
				duration: 280,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}),
		]).start();
		return undefined;
	}, [visible, fade, slide]);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="none"
			statusBarTranslucent
			onRequestClose={onCancel}
		>
			<View style={styles.root}>
				<Animated.View style={[styles.backdrop, { opacity: fade }]}>
					<Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
				</Animated.View>

				<Animated.View
					style={[
						styles.sheet,
						{
							backgroundColor: colors.surface,
							paddingBottom: Math.max(insets.bottom, 16) + 8,
							transform: [{ translateY: slide }],
							opacity: fade,
							borderColor: isDark ? colors.border : 'rgba(10,116,218,0.08)',
						},
					]}
				>
					<View style={[styles.handle, { backgroundColor: colors.border }]} />

					<View style={styles.heroRow}>
						<View style={[styles.iconWrap, { backgroundColor: `${config.THEME_COLOR}14` }]}>
							<View style={[styles.iconInner, { backgroundColor: `${config.THEME_COLOR}22` }]}>
								<Lucide name="bell-ring" size={26} color={config.THEME_COLOR} />
							</View>
						</View>
						<View style={styles.heroCopy}>
							<AppText label={title} variant={1} fontSize={20} color={colors.text} />
							<AppText
								label={message}
								fontSize={14}
								color={colors.textSecondary}
								style={styles.message}
							/>
						</View>
					</View>

					<View
						style={[
							styles.benefits,
							{
								backgroundColor: isDark ? colors.surfaceSecondary : '#F5F8FC',
								borderColor: colors.border,
							},
						]}
					>
						{BENEFITS.map((item, index) => (
							<View
								key={item.label}
								style={[
									styles.benefitRow,
									index < BENEFITS.length - 1 && {
										borderBottomWidth: StyleSheet.hairlineWidth,
										borderBottomColor: colors.border,
									},
								]}
							>
								<View style={[styles.benefitIcon, { backgroundColor: colors.surface }]}>
									<Lucide name={item.icon} size={16} color={config.THEME_COLOR} />
								</View>
								<AppText label={item.label} fontSize={14} color={colors.text} style={{ flex: 1 }} />
								<Lucide name="check" size={16} color={config.GREEN_COLOR || '#62B270'} />
							</View>
						))}
					</View>

					<TouchableOpacity
						activeOpacity={0.88}
						onPress={onConfirm}
						style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR }]}
					>
						<Lucide name="bell" size={18} color="#fff" style={{ marginRight: 8 }} />
						<AppText label={confirmLabel} variant={1} fontSize={16} color="#fff" />
					</TouchableOpacity>

					<TouchableOpacity activeOpacity={0.7} onPress={onCancel} style={styles.secondaryBtn}>
						<AppText label={cancelLabel} fontSize={15} color={colors.textSecondary} />
					</TouchableOpacity>
				</Animated.View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(15, 23, 42, 0.42)',
	},
	sheet: {
		borderTopLeftRadius: 22,
		borderTopRightRadius: 22,
		borderTopWidth: 1,
		paddingHorizontal: 20,
		paddingTop: 10,
		shadowColor: '#0F172A',
		shadowOpacity: 0.12,
		shadowRadius: 24,
		shadowOffset: { width: 0, height: -8 },
		elevation: 16,
	},
	handle: {
		alignSelf: 'center',
		width: 36,
		height: 4,
		borderRadius: 2,
		marginBottom: 18,
	},
	heroRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 18,
	},
	iconWrap: {
		width: 64,
		height: 64,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 14,
	},
	iconInner: {
		width: 48,
		height: 48,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	heroCopy: {
		flex: 1,
		paddingTop: 2,
	},
	message: {
		marginTop: 6,
		lineHeight: 20,
	},
	benefits: {
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
		marginBottom: 18,
	},
	benefitRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 12,
	},
	benefitIcon: {
		width: 30,
		height: 30,
		borderRadius: 9,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 10,
	},
	primaryBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 12,
		paddingVertical: 14,
		marginBottom: 6,
	},
	secondaryBtn: {
		alignItems: 'center',
		paddingVertical: 12,
	},
});

export default NotificationPermissionSheet;
