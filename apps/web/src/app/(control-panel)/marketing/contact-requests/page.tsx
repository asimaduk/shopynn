'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import ContactRequestsPage from './ContactRequestsPage';

export default function ContactRequestsRoute() {
	return (
		<PlanFeatureGate
			requiredPermissions={['contact_requests.view']}
			requiredFeatures={['contact_requests.view']}
			featureTitle="Talk to us"
			backHref="/dashboards/analytics"
		>
			<ContactRequestsPage />
		</PlanFeatureGate>
	);
}
