'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import Locations from './Locations';

export default function LocationsPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['locations.view']}
			requiredFeatures={['locations.view']}
			featureTitle="Locations"
			backHref="/dashboards/analytics"
		>
			<Locations />
		</PlanFeatureGate>
	);
}
