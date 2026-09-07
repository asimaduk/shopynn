'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import DailySales from './DailySales';

export default function DailySalesPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['sales.daily_summary.view']}
			requiredFeatures={['sales.daily_summary.view']}
			featureTitle="Daily sales overview"
			backHref="/dashboards/analytics"
		>
			<DailySales />
		</PlanFeatureGate>
	);
}
