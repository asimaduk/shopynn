'use client';

import FeatureUnavailable from '../../../../parity/FeatureUnavailable';

export default function ReceiveAgainstPOPage() {
	return (
		<FeatureUnavailable
			title="Receive against purchase order"
			message="Purchase orders are not available yet. Use Purchases for supplier stock receipts."
		/>
	);
}
