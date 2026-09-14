import React, { useEffect, useRef } from 'react';
import {
	ActivityIndicator,
	Animated,
	Easing,
	Modal,
	Pressable,
	StyleSheet,
	TouchableOpacity,
	View,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import useTheme from '../hooks/useTheme';

/**
 * Centered confirm dialog — clean replacement for system Alert.
 */
const ConfirmDialog = ({
	visible,
	icon = 'circle-alert',
	title,
	message,
	cancelLabel = 'Cancel',
	confirmLabel = 'Confirm',
	destructive = false,
	loading = false,
	onCancel,
	onConfirm,
}) => {
	const { colors, isDark } = useTheme();
	const fade = useRef(new Animated.Value(0)).current;
	const scale = useRef(new Animated.Value(0.94)).current;

	useEffect(() => {
		if (!visible) return undefined;
		fade.setValue(0);
		scale.setValue(0.94);
		Animated.parallel([
			Animated.timing(fade, {
				toValue: 1,
				duration: 180,
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
		return undefined;
	}, [visible, fade, scale]);

	const accent = destructive ? colors.error || '#dc2626' : colors.primary || '#0A74DA';
	const accentSoft = destructive
		? colors.errorLight || 'rgba(220, 38, 38, 0.12)'
		: colors.primaryShade || 'rgba(10, 116, 218, 0.12)';

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
					<Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onCancel} />
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
					<View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
						<Lucide name={icon} size={26} color={accent} />
					</View>

					<AppText
						label={title}
						variant={1}
						fontSize={18}
						color={colors.text}
						style={styles.title}
					/>
					{!!message && (
						<AppText
							label={message}
							fontSize={14}
							color={colors.textSecondary}
							style={styles.message}
						/>
					)}

					<View style={styles.actions}>
						<TouchableOpacity
							activeOpacity={0.7}
							disabled={loading}
							onPress={onCancel}
							style={[
								styles.btn,
								styles.btnSecondary,
								{
									backgroundColor: colors.surfaceSecondary || colors.background,
									borderColor: colors.border,
									opacity: loading ? 0.6 : 1,
								},
							]}
						>
							<AppText label={cancelLabel} variant={1} fontSize={15} color={colors.text} />
						</TouchableOpacity>

						<TouchableOpacity
							activeOpacity={0.7}
							disabled={loading}
							onPress={onConfirm}
							style={[
								styles.btn,
								styles.btnPrimary,
								{ backgroundColor: accent, opacity: loading ? 0.85 : 1 },
							]}
						>
							{loading ? (
								<ActivityIndicator size="small" color="#fff" />
							) : (
								<AppText label={confirmLabel} variant={1} fontSize={15} color="#fff" />
							)}
						</TouchableOpacity>
					</View>
				</Animated.View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
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
	title: {
		textAlign: 'center',
		marginBottom: 6,
	},
	message: {
		textAlign: 'center',
		lineHeight: 20,
		marginBottom: 22,
		paddingHorizontal: 4,
	},
	actions: {
		flexDirection: 'row',
		width: '100%',
		gap: 10,
	},
	btn: {
		flex: 1,
		height: 46,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	btnSecondary: {
		borderWidth: StyleSheet.hairlineWidth,
	},
	btnPrimary: {},
});

export default ConfirmDialog;
