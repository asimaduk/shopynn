'use client';

import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../../parity/FeatureUnavailable';
import { useReceivePurchaseOrderMutation } from '../../../../parity/ParityApi';

export default function ReceiveAgainstPOPage() {
	const params = useParams<{ id: string }>();
	const [receivePurchaseOrder, { isLoading, isSuccess }] = useReceivePurchaseOrderMutation();

	const onReceive = async () => {
		await receivePurchaseOrder({ id: params.id, body: {} }).unwrap();
	};

	return (
		<PermissionGate
			featureFlag="purchaseOrders"
			requiredPermissions={['purchase_orders.receive', 'purchases.create']}
			fallback={<FeatureUnavailable title="Receive Against PO" message="Feature is disabled or you do not have access." />}
		>
			<Box className="p-24 max-w-xl">
				<Typography variant="h5" className="font-semibold">
					Receive Against Purchase Order
				</Typography>
				<Typography className="mt-8 text-secondary">PO ID: {params.id}</Typography>
				<Button className="mt-16" variant="contained" onClick={onReceive} disabled={isLoading}>
					Confirm Receive
				</Button>
				{isSuccess && <Typography className="mt-12 text-green-700">Receipt completed.</Typography>}
			</Box>
		</PermissionGate>
	);
}
