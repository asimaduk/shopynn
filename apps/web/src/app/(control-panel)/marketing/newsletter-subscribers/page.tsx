'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import NewsletterSubscribersPage from './NewsletterSubscribersPage';

export default function NewsletterSubscribersRoute() {
	return (
		<PlanFeatureGate
			requiredPermissions={['newsletter.subscribers.view']}
			requiredFeatures={['newsletter.subscribers.view']}
			featureTitle="Newsletter subscribers"
			backHref="/dashboards/analytics"
		>
			<NewsletterSubscribersPage />
		</PlanFeatureGate>
	);
}
