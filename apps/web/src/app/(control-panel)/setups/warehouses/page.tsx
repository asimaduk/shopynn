'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import Warehouses from './Warehouses';

export default function WarehousesPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['warehouses.view']}
			requiredFeatures={['stores.multi_access']}
			featureTitle="Stores / branches"
			backHref="/dashboards/analytics"
		>
			<Warehouses />
		</PlanFeatureGate>
	);
}
