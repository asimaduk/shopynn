'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import TenantsDirectoryPage from './TenantsDirectoryPage';

export default function TenantsDirectoryRoutePage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['tenants.directory.view']}
			requiredFeatures={['tenants.directory.view']}
			featureTitle="Tenant directory"
			backHref="/dashboards/analytics"
		>
			<TenantsDirectoryPage />
		</PlanFeatureGate>
	);
}
