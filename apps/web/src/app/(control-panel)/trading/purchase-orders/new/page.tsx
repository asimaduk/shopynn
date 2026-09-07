'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../parity/FeatureUnavailable';
import { useCreatePurchaseOrderMutation } from '../../../parity/ParityApi';

export default function NewPurchaseOrderPage() {
	const [reference, setReference] = useState('');
	const [createPurchaseOrder, { isLoading }] = useCreatePurchaseOrderMutation();

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await createPurchaseOrder({ reference }).unwrap();
		setReference('');
	};

	return (
		<PermissionGate
			featureFlag="purchaseOrders"
			requiredPermissions={['purchase_orders.create', 'purchases.create']}
			fallback={<FeatureUnavailable title="Create Purchase Order" message="Feature is disabled or you do not have access." />}
		>
			<Box className="p-24 max-w-xl">
				<Typography variant="h5" className="font-semibold mb-16">
					New Purchase Order
				</Typography>
				<Box component="form" onSubmit={onSubmit} className="space-y-16">
					<TextField fullWidth label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} required />
					<Button type="submit" variant="contained" disabled={isLoading}>
						Create
					</Button>
				</Box>
			</Box>
		</PermissionGate>
	);
}
