import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';

const CheckoutSuccess = ({ navigation, route }) => {
	const { colors } = useTheme();
	const orderNumber = route?.params?.orderNumber;

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
			<ScreenHeader onPress={() => navigation.goBack()} label="Order Submitted" />
			<View style={styles.container}>
				<View style={[styles.iconWrap, { backgroundColor: '#dcfce7' }]}>
					<Lucide name="check" size={40} color="#16a34a" />
				</View>
				<AppText label="Order placed successfully" variant={1} fontSize={22} color={colors.text} style={{ marginTop: 14 }} />
				<AppText
					label={
						orderNumber
							? `Your order ${orderNumber} has been submitted. The store will confirm it before payment starts.`
							: 'Your order has been submitted. The store will confirm it before payment starts.'
					}
					fontSize={14}
					color={colors.textSecondary}
					style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 22 }}
				/>

				<View style={styles.actions}>
					<TouchableOpacity
						style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR }]}
						onPress={() => navigation.navigate('MyOrders')}
					>
						<AppText label="View my orders" color="#fff" variant={1} />
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
						onPress={() => navigation.navigate('ForYou')}
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
