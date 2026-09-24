'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import OrderPaymentDetailsPage from '../../order-payments/OrderPaymentDetailsPage';

export default function Page() {
	return (
		<PlanFeatureGate
			requiredPermissions={['sales.view']}
			requiredFeatures={['sales.view']}
			featureTitle="POS MoMo payments"
			backHref="/trading/pos-sale-payments"
		>
			<OrderPaymentDetailsPage />
		</PlanFeatureGate>
	);
}
