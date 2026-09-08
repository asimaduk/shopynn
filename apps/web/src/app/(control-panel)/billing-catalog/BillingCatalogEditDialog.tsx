'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import toast from 'react-hot-toast';
import {
	useUpdateBillingCatalogItemMutation,
	type BillingCatalogItem
} from '../billing/BillingCatalogApi';
import { formatCatalogItemType } from './billingCatalogFormat';

type Props = {
	open: boolean;
	item: BillingCatalogItem | null;
	onClose: () => void;
	onSaved: () => void;
};

export default function BillingCatalogEditDialog({ open, item, onClose, onSaved }: Props) {
	const [updateItem, { isLoading: saving }] = useUpdateBillingCatalogItemMutation();
	const [label, setLabel] = useState('');
	const [description, setDescription] = useState('');
	const [amount, setAmount] = useState('');
	const [minAmount, setMinAmount] = useState('');
	const [maxAmount, setMaxAmount] = useState('');
	const [isActive, setIsActive] = useState(true);

	const isMigrationAddon = item?.code === 'addon_data_migration';

	useEffect(() => {
		if (!open || !item) return;
		setLabel(item.label ?? '');
		setDescription(item.description ?? '');
		setAmount(String(item.amount_ghs ?? ''));
		setMinAmount(item.min_amount_ghs != null ? String(item.min_amount_ghs) : '');
		setMaxAmount(item.max_amount_ghs != null ? String(item.max_amount_ghs) : '');
		setIsActive(Boolean(item.is_active));
	}, [open, item]);

	const handleSave = async () => {
		if (!item) return;
		const amount_ghs = Number(amount);
		if (!Number.isFinite(amount_ghs) || amount_ghs < 0) {
			toast.error('Enter a valid amount.');
			return;
		}
		if (!label.trim()) {
			toast.error('Label is required.');
			return;
		}

		const body: Partial<BillingCatalogItem> = {
			label: label.trim(),
			description: description.trim() || null,
			amount_ghs,
			is_active: isActive
		};

		if (isMigrationAddon) {
			if (minAmount !== '') {
				const min = Number(minAmount);
				if (!Number.isFinite(min) || min < 0) {
					toast.error('Enter a valid minimum amount.');
					return;
				}
				body.min_amount_ghs = min;
			}
			if (maxAmount !== '') {
				const max = Number(maxAmount);
				if (!Number.isFinite(max) || max < 0) {
					toast.error('Enter a valid maximum amount.');
					return;
				}
				body.max_amount_ghs = max;
			}
		}

		try {
			await updateItem({ id: item.id, body }).unwrap();
			toast.success('Catalog item updated.');
			onSaved();
		} catch (err: any) {
			toast.error(err?.data?.message || 'Save failed');
		}
	};

	return (
		<Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
			<DialogTitle>Edit catalog item</DialogTitle>
			<DialogContent dividers className="flex flex-col gap-3 pt-2">
				{!item ? (
					<Typography color="text.secondary">No item selected.</Typography>
				) : (
					<>
						<Box className="rounded-md bg-default-50 px-3 py-2">
							<Typography variant="caption" color="text.secondary">
								Code · {formatCatalogItemType(item.item_type)}
								{item.plan_tier ? ` · ${item.plan_tier}` : ''}
							</Typography>
							<Typography variant="body2" fontFamily="monospace">
								{item.code}
							</Typography>
						</Box>

						<TextField
							label="Label"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							fullWidth
							required
							disabled={saving}
						/>
						<TextField
							label="Description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							fullWidth
							multiline
							minRows={2}
							disabled={saving}
						/>
						<TextField
							label="Amount (GHS)"
							type="number"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							fullWidth
							required
							inputProps={{ min: 0, step: 0.01 }}
							disabled={saving}
						/>
						{isMigrationAddon ? (
							<Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<TextField
									label="Min amount (GHS)"
									type="number"
									value={minAmount}
									onChange={(e) => setMinAmount(e.target.value)}
									inputProps={{ min: 0, step: 0.01 }}
									disabled={saving}
								/>
								<TextField
									label="Max amount (GHS)"
									type="number"
									value={maxAmount}
									onChange={(e) => setMaxAmount(e.target.value)}
									inputProps={{ min: 0, step: 0.01 }}
									disabled={saving}
								/>
							</Box>
						) : null}
						<TextField
							select
							label="Commission"
							value={item.commission_eligible}
							fullWidth
							disabled
							helperText="Commission eligibility is fixed per catalog code."
						>
							<MenuItem value={item.commission_eligible}>{item.commission_eligible}</MenuItem>
						</TextField>
						<FormControlLabel
							control={
								<Switch
									checked={isActive}
									onChange={(e) => setIsActive(e.target.checked)}
									disabled={saving}
								/>
							}
							label="Active"
						/>
					</>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={saving}>
					Cancel
				</Button>
				<Button variant="contained" onClick={handleSave} disabled={saving || !item}>
					{saving ? 'Saving…' : 'Save changes'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
