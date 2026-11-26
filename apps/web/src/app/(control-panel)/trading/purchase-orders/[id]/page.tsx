'use client';

import FeatureUnavailable from '../../../parity/FeatureUnavailable';

export default function PurchaseOrderDetailPage() {
	return (
		<FeatureUnavailable
			title="Purchase order"
			message="Purchase orders are not available yet. Use Purchases for supplier stock receipts."
		/>
	);
}
