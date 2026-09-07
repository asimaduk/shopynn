'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../parity/FeatureUnavailable';
import { useGetReceiptSettingsQuery, useUpdateReceiptSettingsMutation } from '../../../parity/ParityApi';

export default function ReceiptSettingsPage() {
	const { data } = useGetReceiptSettingsQuery();
	const [updateReceiptSettings, { isLoading, isSuccess }] = useUpdateReceiptSettingsMutation();
	const initialCompany = useMemo(() => data?.receiptCompanyName || '', [data]);
	const [companyName, setCompanyName] = useState(initialCompany);

	const onSave = async (e: React.FormEvent) => {
		e.preventDefault();
		await updateReceiptSettings({ receiptCompanyName: companyName }).unwrap();
	};

	return (
		<PermissionGate
			featureFlag="receiptSettings"
			requiredPermissions={['receipt_settings.view']}
			fallback={<FeatureUnavailable title="Receipt Settings" message="Feature is disabled or you do not have access." />}
		>
			<Box className="p-24 max-w-xl">
				<Typography variant="h5" className="font-semibold mb-16">
					Invoice & Receipt Settings
				</Typography>
				<Box component="form" onSubmit={onSave} className="space-y-16">
					<TextField
						fullWidth
						label="Receipt Company Name"
						value={companyName}
						onChange={(e) => setCompanyName(e.target.value)}
					/>
					<Button type="submit" variant="contained" disabled={isLoading}>
						Save
					</Button>
				</Box>
				{isSuccess && <Typography className="mt-12 text-green-700">Settings saved.</Typography>}
			</Box>
		</PermissionGate>
	);
}
