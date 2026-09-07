'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import Expiring from './Expiring';

export default function ExpiringPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['inventory.expiring.view']}
			requiredFeatures={['inventory.expiring.view']}
			featureTitle="Expiring stock"
			backHref="/inventory/products"
		>
			<Expiring />
		</PlanFeatureGate>
	);
}
