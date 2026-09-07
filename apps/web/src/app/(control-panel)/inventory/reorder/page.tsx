'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import Reorder from './Reorder';

export default function ReorderPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['inventory.reorder.view']}
			requiredFeatures={['inventory.reorder.view']}
			featureTitle="Reorder list"
			backHref="/inventory/products"
		>
			<Reorder />
		</PlanFeatureGate>
	);
}
