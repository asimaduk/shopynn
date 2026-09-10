'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import BroadcastPage from './BroadcastPage';

export default function BroadcastRoute() {
	return (
		<PlanFeatureGate
			requiredPermissions={['tenants.directory.view', 'broadcasts.send']}
			requiredFeatures={['tenants.directory.view', 'broadcasts.send']}
			featureTitle="Broadcast"
			backHref="/dashboards/analytics"
		>
			<BroadcastPage />
		</PlanFeatureGate>
	);
}
