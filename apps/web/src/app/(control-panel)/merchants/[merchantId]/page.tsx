'use client';

import PlanFeatureGate from '@auth/PlanFeatureGate';
import { useParams } from 'next/navigation';
import MerchantDetailPage from '../MerchantDetailPage';

export default function MerchantDetailRoute() {
	const params = useParams();
	const merchantId = typeof params?.merchantId === 'string' ? params.merchantId : '';

	return (
		<PlanFeatureGate
			requiredPermissions={['merchants.view']}
			requiredFeatures={['merchants.view']}
			featureTitle="Merchant admin"
			backHref="/merchants"
		>
			<MerchantDetailPage merchantId={merchantId} />
		</PlanFeatureGate>
	);
}
