'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import FuseLoading from '@fuse/core/FuseLoading';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../parity/FeatureUnavailable';
import { useGetPurchaseOrdersQuery } from '../../parity/ParityApi';

export default function PurchaseOrdersPage() {
	const { data, isLoading } = useGetPurchaseOrdersQuery();
	const list = Array.isArray(data) ? data : data?.items || data?.list || [];

	return (
		<PermissionGate
			featureFlag="purchaseOrders"
			requiredPermissions={['purchase_orders.view', 'purchases.view']}
			fallback={<FeatureUnavailable title="Purchase Orders" message="Feature is disabled or you do not have access." />}
		>
			<Box className="p-24">
				<Box className="flex items-center justify-between">
					<Typography variant="h5" className="font-semibold">
						Purchase Orders
					</Typography>
					<PermissionGate requiredPermissions={['purchase_orders.create']} requiredFeatures={['purchase_orders.create']}>
						<Button variant="contained" component={Link} href="/trading/purchase-orders/new">
							New Purchase Order
						</Button>
					</PermissionGate>
				</Box>
				{isLoading ? (
					<FuseLoading />
				) : (
					<Box className="mt-16 space-y-8">
						{list.map((po: any) => (
							<Box key={po.id} className="border rounded-lg p-12 flex items-center justify-between">
								<Typography>{po.reference || po.id}</Typography>
								<Button component={Link} href={`/trading/purchase-orders/${po.id}`}>
									View
								</Button>
							</Box>
						))}
						{list.length === 0 && <Typography className="text-secondary">No purchase orders found.</Typography>}
					</Box>
				)}
			</Box>
		</PermissionGate>
	);
}
