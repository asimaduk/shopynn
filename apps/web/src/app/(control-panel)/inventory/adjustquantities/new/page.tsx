'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import AdjustQuantities from '../AdjustQuantities';

export default function NewAdjustQuantitiesPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['adjustments.create']}
			requiredFeatures={['adjustments.create']}
			featureTitle="Stock adjustments"
			backHref="/inventory/adjustquantities"
		>
			<AdjustQuantities />
		</PlanFeatureGate>
	);
}
