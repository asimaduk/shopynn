'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import StockCount from './StockCount';

export default function StockCountPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['stock_counts.view']}
			requiredFeatures={['stock_counts.view']}
			featureTitle="Stock count / audit"
			backHref="/inventory/products"
		>
			<StockCount />
		</PlanFeatureGate>
	);
}
