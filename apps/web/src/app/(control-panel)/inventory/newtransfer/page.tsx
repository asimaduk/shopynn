'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import NewTransfer from './NewTransfer';

export default function NewTransferPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['transfers.create']}
			requiredFeatures={['transfers.create']}
			featureTitle="Stock transfers"
			backHref="/inventory/transfers"
		>
			<NewTransfer />
		</PlanFeatureGate>
	);
}
