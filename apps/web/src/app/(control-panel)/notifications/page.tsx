'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import NotificationsTab from './NotificationsTab';

export default function NotificationsPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['notifications.view']}
			requiredFeatures={['notifications.view']}
			featureTitle="Notifications"
			backHref="/dashboards/analytics"
		>
			<NotificationsTab />
		</PlanFeatureGate>
	);
}
