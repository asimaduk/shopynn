'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import SiteChatsPage from './SiteChatsPage';

export default function SiteChatsRoute() {
	return (
		<PlanFeatureGate
			requiredPermissions={['site_chat.sessions.view']}
			requiredFeatures={['site_chat.sessions.view']}
			featureTitle="Live chat"
			backHref="/dashboards/analytics"
		>
			<SiteChatsPage />
		</PlanFeatureGate>
	);
}
