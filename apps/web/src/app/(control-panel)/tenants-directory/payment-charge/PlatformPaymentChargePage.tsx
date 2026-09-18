'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import {
	useGetMomoPaymentChargeQuery,
	useUpdateMomoPaymentChargeMutation
} from '../../billing/SubscriptionApi';
import toast from 'react-hot-toast';

export default function PlatformPaymentChargePage() {
	const { data, isLoading, refetch } = useGetMomoPaymentChargeQuery();
	const [update, { isLoading: saving }] = useUpdateMomoPaymentChargeMutation();
	const [enabled, setEnabled] = useState(true);
	const [percent, setPercent] = useState('2');

	useEffect(() => {
		if (!data) return;
		setEnabled(Boolean(data.enabled));
		setPercent(String(data.percent ?? 2));
	}, [data]);

	const minPercent = data?.min_percent ?? 2;

	const handleSave = async () => {
		const n = Number(percent);
		if (!Number.isFinite(n)) {
			toast.error('Enter a valid percent');
			return;
		}
		if (enabled && n < minPercent) {
			toast.error(`Minimum is ${minPercent}%`);
			return;
		}
		try {
			await update({ enabled, percent: n }).unwrap();
			toast.success('Platform MoMo charge saved');
			refetch();
		} catch (err: any) {
			toast.error(err?.data?.message || 'Could not save');
		}
	};

	return (
		<PlanFeatureGate requiredFeatures={['tenants.directory.view']} requiredPermissions={['tenants.directory.view']}>
			<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
				<PageBreadcrumb className="mb-4" />
				<Typography component="h1" className="text-3xl font-extrabold tracking-tight">
					Platform MoMo charge
				</Typography>
				<Typography variant="body2" color="text.secondary" className="mb-4 mt-1 max-w-2xl">
					Customers pay sale/order total plus this percent on digital MoMo/card collections. Merchants withdraw
					face value only. Default and minimum 2%. Super admin only.
				</Typography>

				{isLoading ? (
					<FuseLoading />
				) : (
					<Paper variant="outlined" className="max-w-md p-4">
						<FormControlLabel
							control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
							label="Enable platform charge"
						/>
						<TextField
							fullWidth
							className="mt-3"
							label="Percent"
							type="number"
							value={percent}
							onChange={(e) => setPercent(e.target.value)}
							inputProps={{ min: minPercent, step: 0.01 }}
							helperText={`Minimum ${minPercent}% when enabled`}
							disabled={!enabled}
						/>
						<Alert severity="info" className="mt-3">
							At 2%, collection fees are roughly covered; transfer costs are funded by subscriptions. Extra
							above face value stays with the platform.
						</Alert>
						<Button className="mt-4" variant="contained" disabled={saving} onClick={handleSave}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</Paper>
				)}
			</Box>
		</PlanFeatureGate>
	);
}
