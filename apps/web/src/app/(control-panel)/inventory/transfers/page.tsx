'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import Transfers from './Transfers';

export default function TransfersPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['transfers.view']}
			requiredFeatures={['transfers.view']}
			featureTitle="Stock transfers"
			backHref="/dashboards/analytics"
		>
			<Transfers />
		</PlanFeatureGate>
	);
}
