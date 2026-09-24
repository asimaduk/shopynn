'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import PosSalePaymentsPage from './PosSalePaymentsPage';

export default function TradingPosSalePaymentsPage() {
	return (
		<PlanFeatureGate
			requiredPermissions={['sales.view']}
			requiredFeatures={['sales.view']}
			featureTitle="POS MoMo payments"
			backHref="/trading/sales"
		>
			<PosSalePaymentsPage />
		</PlanFeatureGate>
	);
}
