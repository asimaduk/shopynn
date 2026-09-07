'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import NewStockCount from './NewStockCount';

export default function NewStockCountPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['stock_counts.create']}
			requiredFeatures={['stock_counts.create']}
			featureTitle="Stock count / audit"
			backHref="/inventory/stock-count"
		>
			<NewStockCount />
		</PlanFeatureGate>
	);
}
