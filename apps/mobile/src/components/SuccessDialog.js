import React, { useEffect, useRef } from 'react';
import {
	ActivityIndicator,
	Animated,
	Easing,
	Modal,
	StyleSheet,
	TouchableOpacity,
	View,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import useTheme from '../hooks/useTheme';

/**
 * Centered success dialog for completed flows (account created, payment done, …).
 * Same card language as ConfirmDialog; not dismissible by backdrop so the user takes the next step.
 *
 * details: [{ icon, label, value }] rendered as a compact summary card.
 * tone: 'success' (green) or 'primary' (brand blue, for informational steps like "code sent").
 */
const SuccessDialog = ({
	visible,
	icon = 'check',
	tone = 'success',
	title,
	message,
	details = [],
	primaryLabel = 'Continue',
	secondaryLabel,
	loading = false,
	onPrimary,
	onSecondary,
	onRequestClose,
}) => {
	const { colors, isDark } = useTheme();
	const fade = useRef(new Animated.Value(0)).current;
	const scale = useRef(new Animated.Value(0.94)).current;
	const badge = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!visible) return undefined;
		fade.setValue(0);
		scale.setValue(0.94);
		badge.setValue(0);
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
			Animated.sequence([
				Animated.delay(120),
				Animated.spring(badge, {
					toValue: 1,
					friction: 5,
					tension: 140,
					useNativeDriver: true,
				}),
			]),
		]).start();
		return undefined;
	}, [visible, fade, scale, badge]);

	const isPrimary = tone === 'primary';
	const accent = isPrimary ? colors.primary || '#0A74DA' : colors.success || '#10b981';
	const accentSoft = isPrimary
		? colors.primaryShade || '#e8f4fc'
		: isDark
			? 'rgba(16, 185, 129, 0.18)'
			: colors.successLight || '#d1fae5';
	const rows = (details || []).filter((d) => d && d.value);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="none"
			statusBarTranslucent
			onRequestClose={onRequestClose || onPrimary}
		>
			<View style={styles.root}>
				<Animated.View style={[styles.backdrop, { opacity: fade }]} />

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
					<View style={[styles.halo, { backgroundColor: accentSoft }]}>
						<Animated.View
							style={[
								styles.badge,
								{
									backgroundColor: accent,
									transform: [{ scale: badge }],
								},
							]}
						>
							<Lucide name={icon} size={28} color="#fff" strokeWidth={3} />
						</Animated.View>
					</View>

					<AppText
						label={title}
						variant={1}
						fontSize={20}
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

					{rows.length > 0 && (
						<View
							style={[
								styles.details,
								{
									backgroundColor: colors.surfaceSecondary || colors.background,
									borderColor: colors.border,
								},
							]}
						>
							{rows.map((row, idx) => (
								<View
									key={`${row.label}-${idx}`}
									style={[
										styles.detailRow,
										idx > 0 && {
											borderTopWidth: StyleSheet.hairlineWidth,
											borderTopColor: colors.border,
										},
									]}
								>
									<Lucide name={row.icon || 'info'} size={16} color={colors.textTertiary} />
									<AppText
										label={row.label}
										fontSize={13}
										color={colors.textTertiary}
										style={styles.detailLabel}
									/>
									<AppText
										label={String(row.value)}
										variant={1}
										fontSize={13}
										color={colors.text}
										style={styles.detailValue}
										numberOfLines={1}
									/>
								</View>
							))}
						</View>
					)}

					<TouchableOpacity
						activeOpacity={0.8}
						disabled={loading}
						onPress={onPrimary}
						style={[styles.btn, { backgroundColor: accent, opacity: loading ? 0.85 : 1 }]}
					>
						{loading ? (
							<ActivityIndicator size="small" color="#fff" />
						) : (
							<View style={styles.btnInner}>
								<AppText label={primaryLabel} variant={1} fontSize={15} color="#fff" />
								<Lucide name="arrow-right" size={18} color="#fff" style={styles.btnIcon} />
							</View>
						)}
					</TouchableOpacity>

					{!!secondaryLabel && (
						<TouchableOpacity
							activeOpacity={0.7}
							disabled={loading}
							onPress={onSecondary}
							style={styles.secondaryBtn}
						>
							<AppText label={secondaryLabel} fontSize={14} color={colors.textSecondary} />
						</TouchableOpacity>
					)}
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
		backgroundColor: 'rgba(15, 23, 42, 0.5)',
	},
	card: {
		width: '100%',
		maxWidth: 340,
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 22,
		paddingTop: 28,
		paddingBottom: 16,
		alignItems: 'center',
		shadowColor: '#0f172a',
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.16,
		shadowRadius: 24,
		elevation: 8,
	},
	halo: {
		width: 84,
		height: 84,
		borderRadius: 42,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 16,
	},
	badge: {
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: 'center',
		justifyContent: 'center',
	},
	title: {
		textAlign: 'center',
		marginBottom: 6,
	},
	message: {
		textAlign: 'center',
		lineHeight: 20,
		marginBottom: 18,
		paddingHorizontal: 4,
	},
	details: {
		width: '100%',
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 12,
		marginBottom: 18,
	},
	detailRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
	},
	detailLabel: {
		marginLeft: 8,
	},
	detailValue: {
		flex: 1,
		textAlign: 'right',
		marginLeft: 12,
	},
	btn: {
		width: '100%',
		height: 48,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	btnInner: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	btnIcon: {
		marginLeft: 8,
	},
	secondaryBtn: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		marginTop: 2,
	},
});

export default SuccessDialog;
