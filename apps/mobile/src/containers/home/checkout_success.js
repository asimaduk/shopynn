import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';

const CheckoutSuccess = ({ navigation, route }) => {
	const { colors } = useTheme();
	const orderNumber = route?.params?.orderNumber;
	const orderId = route?.params?.orderId;
	const totalAmount = Number(route?.params?.totalAmount || 0);
	const paymentMode = String(route?.params?.paymentMode || 'full').toLowerCase();
	const payTiming = String(route?.params?.payTiming || 'later').toLowerCase();
	const canPayNow =
		Boolean(orderId) &&
		paymentMode !== 'installment' &&
		payTiming === 'now' &&
		Number.isFinite(totalAmount) &&
		totalAmount > 0;

	const goToForYou = () => {
		navigation.dispatch(
			CommonActions.reset({
				index: 0,
				routes: [{ name: 'Home', params: { screen: 'ForYou' } }],
			}),
		);
	};

	const goToMyOrders = () => {
		navigation.dispatch(
			CommonActions.reset({
				index: 0,
				routes: [{ name: 'Home', params: { screen: 'MyOrders' } }],
			}),
		);
	};

	const goPayNow = () => {
		if (!orderId) return;
		navigation.replace('Payment', {
			flowType: 'order',
			orderId,
			amount: totalAmount,
			planName: orderNumber || 'Order payment',
			onSuccessNavigateTo: 'MyOrderDetails',
			onSuccessNavigateParams: { orderId },
		});
	};

	const goViewOrder = () => {
		if (!orderId) {
			goToMyOrders();
			return;
		}
		navigation.replace('MyOrderDetails', { orderId });
	};

	return (
		<SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
			<ScreenHeader hideBack label="Order Submitted" />
			<View style={styles.container}>
				<View style={[styles.iconWrap, { backgroundColor: '#dcfce7' }]}>
					<Lucide name="check" size={40} color="#16a34a" />
				</View>
				<AppText label="Order placed successfully" variant={1} fontSize={22} color={colors.text} style={{ marginTop: 14 }} />
				<AppText
					label={
						canPayNow
							? orderNumber
								? `Your order ${orderNumber} is ready. Pay now with MoMo or card to confirm with the store.`
								: 'Your order is ready. Pay now with MoMo or card to confirm with the store.'
							: orderNumber
								? `Your order ${orderNumber} has been submitted. You can pay from order details anytime while it is pending or confirmed.`
								: 'Your order has been submitted. You can pay from order details anytime while it is pending or confirmed.'
					}
					fontSize={14}
					color={colors.textSecondary}
					style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 22 }}
				/>

				<View style={styles.actions}>
					{canPayNow ? (
						<TouchableOpacity
							activeOpacity={0.85}
							style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR }]}
							onPress={goPayNow}
						>
							<AppText
								label={`Pay now · GHS ${totalAmount.toFixed(2)}`}
								color="#fff"
								variant={1}
							/>
						</TouchableOpacity>
					) : null}
					<TouchableOpacity
						activeOpacity={0.85}
						style={[
							canPayNow
								? [styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]
								: [styles.primaryBtn, { backgroundColor: config.THEME_COLOR }],
						]}
						onPress={goViewOrder}
					>
						<AppText
							label={orderId ? 'View order' : 'View my orders'}
							color={canPayNow ? colors.text : '#fff'}
							variant={1}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						activeOpacity={0.85}
						style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
						onPress={goToForYou}
					>
						<AppText label="Continue shopping" color={colors.text} variant={1} />
					</TouchableOpacity>
				</View>
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	iconWrap: {
		width: 96,
		height: 96,
		borderRadius: 48,
		alignItems: 'center',
		justifyContent: 'center',
	},
	actions: {
		width: '100%',
		marginTop: 24,
		gap: 10,
	},
	primaryBtn: {
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: 'center',
	},
	secondaryBtn: {
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: 'center',
		borderWidth: 1,
	},
});

export default CheckoutSuccess;
