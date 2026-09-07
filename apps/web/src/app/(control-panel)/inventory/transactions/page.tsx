'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import Transactions from './Transactions';

export default function TransactionsPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['products.transactions.view']}
			requiredFeatures={['products.transactions.view']}
			featureTitle="Product transactions"
			backHref="/inventory/products"
		>
			<Transactions />
		</PlanFeatureGate>
	);
}
