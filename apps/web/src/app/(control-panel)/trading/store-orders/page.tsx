'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import StoreOrders from './StoreOrders';

export default function TradingStoreOrdersPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['orders.store.view']}
			requiredFeatures={['orders.store.view']}
			featureTitle="Online orders"
			backHref="/dashboards/analytics"
		>
			<StoreOrders />
		</PlanFeatureGate>
	);
}
