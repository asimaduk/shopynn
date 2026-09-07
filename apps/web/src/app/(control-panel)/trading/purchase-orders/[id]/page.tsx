'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../parity/FeatureUnavailable';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetPurchaseOrderByIdQuery } from '../../../parity/ParityApi';

export default function PurchaseOrderDetailPage() {
	const params = useParams<{ id: string }>();
	const { data, isLoading } = useGetPurchaseOrderByIdQuery(params.id);

	return (
		<PermissionGate
			featureFlag="purchaseOrders"
			requiredPermissions={['purchase_orders.view', 'purchases.view']}
			fallback={<FeatureUnavailable title="Purchase Order Details" message="Feature is disabled or you do not have access." />}
		>
			<Box className="p-24">
				{isLoading ? (
					<FuseLoading />
				) : (
					<>
						<Typography variant="h5" className="font-semibold">
							Purchase Order {data?.reference || params.id}
						</Typography>
						<Typography className="mt-8 text-secondary">Status: {data?.status || 'Pending'}</Typography>
						<Button className="mt-16" variant="contained" component={Link} href={`/trading/purchase-orders/${params.id}/receive`}>
							Receive Against PO
						</Button>
					</>
				)}
			</Box>
		</PermissionGate>
	);
}
