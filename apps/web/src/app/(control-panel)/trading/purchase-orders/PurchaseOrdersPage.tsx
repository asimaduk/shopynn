'use client';

import FeatureUnavailable from '../../parity/FeatureUnavailable';

/**
 * Purchase-order workflow is not shipping yet. Routes stay for deep links /
 * future work; do not reintroduce localStorage or mock CRUD here.
 */
export default function PurchaseOrdersPage() {
	return (
		<FeatureUnavailable
			title="Purchase orders"
			message="Purchase orders are not available yet. Use Purchases for supplier stock receipts."
		/>
	);
}
