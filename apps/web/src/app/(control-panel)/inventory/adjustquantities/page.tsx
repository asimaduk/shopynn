'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import AdjustmentHistory from './AdjustmentHistory';

export default function AdjustQuantitiesPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['adjustments.view']}
			requiredFeatures={['adjustments.view']}
			featureTitle="Stock adjustments"
			backHref="/inventory/products"
		>
			<AdjustmentHistory />
		</PlanFeatureGate>
	);
}
