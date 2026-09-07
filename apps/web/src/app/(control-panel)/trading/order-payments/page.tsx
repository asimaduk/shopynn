'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import OrderPaymentsPage from './OrderPaymentsPage';

export default function TradingOrderPaymentsPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['payments.view']}
			requiredFeatures={['payments.view']}
			featureTitle="Order payments"
			backHref="/trading/store-orders"
		>
			<OrderPaymentsPage />
		</PlanFeatureGate>
	);
}
