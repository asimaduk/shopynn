'use client';

import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetAdminMerchantsQuery } from '../merchants/MerchantApi';
import '../merchants/MerchantApi';
import { useAssignTenantServingMerchantMutation } from './TenantsDirectoryApi';
import { userDisplayName } from '../merchants/merchantFormatters';

type Props = {
	open: boolean;
	onClose: () => void;
	tenantId: string | null;
	tenantName?: string | null;
	currentMerchantId?: string | null;
	onSaved?: () => void;
};

export default function SwitchServingMerchantDialog({
	open,
	onClose,
	tenantId,
	tenantName,
	currentMerchantId,
	onSaved
}: Props) {
	const { data, isLoading } = useGetAdminMerchantsQuery(undefined, { skip: !open });
	const merchants = data?.merchants ?? [];
	const [assign, { isLoading: saving }] = useAssignTenantServingMerchantMutation();
	const [merchantId, setMerchantId] = useState<string>('');
	const [reason, setReason] = useState('');

	useEffect(() => {
		if (!open) return;
		setMerchantId(currentMerchantId ?? '');
		setReason('');
	}, [open, currentMerchantId]);

	const options = useMemo(
		() =>
			[...merchants].sort((a, b) =>
				userDisplayName(a).localeCompare(userDisplayName(b), undefined, { sensitivity: 'base' })
			),
		[merchants]
	);

	const handleSave = async () => {
		if (!tenantId) return;
		try {
			const result = await assign({
				tenantId,
				merchant_id: merchantId ? merchantId : null,
				reason: reason.trim() || undefined
			}).unwrap();
			toast.success(result.unchanged ? 'No change.' : 'Serving agent updated.');
			onSaved?.();
			onClose();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; error?: string };
			toast.error(err?.data?.message || err?.error || 'Could not update serving agent');
		}
	};

	return (
		<Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
			<DialogTitle>Switch serving agent</DialogTitle>
			<DialogContent className="flex flex-col gap-3 pt-2">
				<Typography variant="body2" color="text.secondary">
					{tenantName ? (
						<>
							Choose who earns the <strong>5% subscription residual</strong> for{' '}
							<strong>{tenantName}</strong>. Clear the agent to end residual (Shopynn support
							takes over).
						</>
					) : (
						<>
							Choose who earns the <strong>5% subscription residual</strong> for this shop. Clear
							to end residual.
						</>
					)}
				</Typography>
				{isLoading ? (
					<FuseLoading />
				) : (
					<>
						<TextField
							select
							label="Serving agent"
							value={merchantId}
							onChange={(e) => setMerchantId(e.target.value)}
							fullWidth
							disabled={saving}
						>
							<MenuItem value="">
								<em>None — no residual</em>
							</MenuItem>
							{options.map((m) => (
								<MenuItem key={m.id} value={m.id}>
									{userDisplayName(m)}
									{m.email ? ` · ${m.email}` : ''}
								</MenuItem>
							))}
						</TextField>
						<TextField
							label="Reason (optional)"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							fullWidth
							multiline
							minRows={2}
							disabled={saving}
							placeholder="e.g. Owner requested new agent; previous agent inactive"
						/>
					</>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={saving}>
					Cancel
				</Button>
				<Button variant="contained" onClick={handleSave} disabled={saving || isLoading || !tenantId}>
					{saving ? 'Saving…' : 'Save'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
