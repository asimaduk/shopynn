'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import RolesPermissionsTab from './RolesPermissionsTab';

export default function RolesPermissionsPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['roles.view', 'users.roles.view', 'users.view']}
			requiredFeatures={['roles.view', 'users.roles.view', 'users.view']}
			featureTitle="Roles & permissions"
			backHref="/dashboards/analytics"
		>
			<RolesPermissionsTab />
		</PlanFeatureGate>
	);
}
