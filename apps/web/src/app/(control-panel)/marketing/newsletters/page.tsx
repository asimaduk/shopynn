'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import NewslettersPage from './NewslettersPage';

export default function NewslettersRoute() {
	return (
		<PlanFeatureGate
			requiredPermissions={['newsletter.campaigns.view']}
			requiredFeatures={['newsletter.campaigns.view']}
			featureTitle="Newsletters"
			backHref="/dashboards/analytics"
		>
			<NewslettersPage />
		</PlanFeatureGate>
	);
}
