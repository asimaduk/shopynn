'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import UsersTab from '../../apps/settings/users/UsersTab';

export default function StaffUsersPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['users.view']}
			requiredFeatures={['users.view']}
			featureTitle="User management"
			backHref="/dashboards/analytics"
		>
			<UsersTab />
		</PlanFeatureGate>
	);
}
