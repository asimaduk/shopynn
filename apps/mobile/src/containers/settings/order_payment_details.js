import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { payments } from '../../services/api';

const canReverse = (payment) => {
	const method = String(payment?.payment_method_type || '').toLowerCase();
	const status = String(payment?.status || '').toLowerCase();
	return method === 'cash' && ['success', 'paid', 'completed'].includes(status);
};

export default function OrderPaymentDetails({ navigation, route }) {
	const { colors } = useTheme();
	const paymentId = route?.params?.paymentId;
	const [loading, setLoading] = useState(true);
	const [reversing, setReversing] = useState(false);
	const [receipt, setReceipt] = useState(null);
	const [reason, setReason] = useState('');

	const events = useMemo(() => (Array.isArray(receipt?.events) ? receipt.events : []), [receipt?.events]);

	const load = async () => {
		try {
			const data = await payments.receipt(paymentId);
			setReceipt(data || null);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, [paymentId]);

	const onReverse = async () => {
		const trimmedReason = reason.trim();
		if (!trimmedReason) {
			Alert.alert('Reason required', 'Please provide a reason before reversing this payment.');
			return;
		}
		Alert.alert(
			'Confirm reversal',
			'Are you sure you want to reverse this cash payment?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Reverse',
					style: 'destructive',
					onPress: async () => {
						setReversing(true);
						try {
							await payments.reverse(paymentId, { reason: trimmedReason });
							setReason('');
							await load();
						} catch (e) {
							Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Could not reverse payment.');
						} finally {
							setReversing(false);
						}
					}
				}
			]
		);
	};

	return (
		<SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
			<ScreenHeader onPress={() => navigation.goBack()} label="Payment Receipt" />
			{loading ? (
				<View style={styles.center}>
					<ActivityIndicator color={config.THEME_COLOR} />
				</View>
			) : (
				<ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
					<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<AppText label={`Order: ${receipt?.order_number || receipt?.order_id || '—'}`} color={colors.text} />
						<AppText label={`Amount: GHS ${Number(receipt?.amount || 0).toFixed(2)}`} color={colors.text} style={{ marginTop: 6 }} />
						<AppText label={`Method: ${receipt?.payment_method_type || '—'}`} color={colors.textSecondary} style={{ marginTop: 6 }} />
						<AppText label={`Status: ${String(receipt?.status || '').toUpperCase() || '—'}`} color={config.THEME_COLOR} style={{ marginTop: 6 }} />
						<AppText label={`Ref: ${receipt?.transaction_ref || '—'}`} color={colors.textTertiary} style={{ marginTop: 6 }} />
					</View>

					<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<AppText label="Payment History" variant={1} color={colors.text} />
						{events.map((event) => (
							<View key={event.id} style={styles.eventRow}>
								<View style={{ flex: 1 }}>
									<AppText label={event.event_type} color={colors.text} />
									<AppText label={event.note || 'Event'} fontSize={12} color={colors.textSecondary} />
								</View>
								<AppText label={event.created_at ? new Date(event.created_at).toLocaleString() : '—'} fontSize={11} color={colors.textTertiary} />
							</View>
						))}
					</View>

					{canReverse(receipt) ? (
						<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
							<AppText label="Reverse Cash Payment" variant={1} color={colors.text} />
							<TextInput
								value={reason}
								onChangeText={setReason}
								placeholder="Reason (optional)"
								placeholderTextColor={colors.placeholder}
								style={[styles.input, { borderColor: colors.border, color: colors.text }]}
							/>
							<TouchableOpacity disabled={reversing} onPress={onReverse} style={[styles.btn, { backgroundColor: '#DC2626' }]}>
								<AppText label={reversing ? 'Reversing...' : 'Reverse Payment'} color="#fff" />
							</TouchableOpacity>
						</View>
					) : null}
				</ScrollView>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 1,
		borderRadius: 10,
		padding: 12,
		marginBottom: 10,
	},
	eventRow: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 10,
	},
	input: {
		height: 42,
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 10,
		marginTop: 10,
		fontFamily: 'FiraSans-Regular',
	},
	btn: {
		marginTop: 10,
		borderRadius: 8,
		height: 42,
		alignItems: 'center',
		justifyContent: 'center',
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
