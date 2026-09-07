'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import BillingCatalogAdminPage from './BillingCatalogAdminPage';

export default function BillingCatalogPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['tenants.directory.view']}
			requiredFeatures={['tenants.directory.view']}
			featureTitle="Billing catalog"
			backHref="/dashboards/analytics"
		>
			<BillingCatalogAdminPage />
		</PlanFeatureGate>
	);
}
