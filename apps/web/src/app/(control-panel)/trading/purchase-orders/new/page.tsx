'use client';

import FeatureUnavailable from '../../../parity/FeatureUnavailable';

export default function NewPurchaseOrderPage() {
	return (
		<FeatureUnavailable
			title="Create purchase order"
			message="Purchase orders are not available yet. Use New Purchase for supplier stock receipts."
		/>
	);
}
