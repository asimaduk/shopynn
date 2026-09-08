'use client';

import type { ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { BillingCatalogItem } from '../billing/BillingCatalogApi';
import { formatCatalogAmount, formatCatalogItemType, formatCatalogCommission } from './billingCatalogFormat';

type Props = {
	open: boolean;
	item: BillingCatalogItem | null;
	onClose: () => void;
	onEdit: () => void;
};

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<Box className="grid grid-cols-[140px_1fr] gap-2 border-b border-divider py-2 last:border-0 sm:grid-cols-[160px_1fr]">
			<Typography variant="body2" color="text.secondary">
				{label}
			</Typography>
			<Typography variant="body2" component="div" className="break-words">
				{value}
			</Typography>
		</Box>
	);
}

export default function BillingCatalogDetailDialog({ open, item, onClose, onEdit }: Props) {
	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>Catalog item</DialogTitle>
			<DialogContent dividers>
				{!item ? (
					<Typography color="text.secondary">No item selected.</Typography>
				) : (
					<Box>
						<Box className="mb-3 flex flex-wrap items-center gap-2">
							<Typography variant="h6" fontWeight={600}>
								{item.label}
							</Typography>
							<Chip
								size="small"
								label={item.is_active ? 'Active' : 'Inactive'}
								color={item.is_active ? 'success' : 'default'}
								variant="outlined"
							/>
							<Chip size="small" label={formatCatalogItemType(item.item_type)} variant="outlined" />
						</Box>

						<DetailRow
							label="Code"
							value={
								<Typography variant="body2" fontFamily="monospace">
									{item.code}
								</Typography>
							}
						/>
						<DetailRow label="Plan tier" value={item.plan_tier || '—'} />
						<DetailRow label="Amount" value={`${formatCatalogAmount(item.amount_ghs)} GHS`} />
						{(item.min_amount_ghs != null || item.max_amount_ghs != null) && (
							<DetailRow
								label="Amount range"
								value={`${formatCatalogAmount(item.min_amount_ghs)} – ${formatCatalogAmount(item.max_amount_ghs)} GHS`}
							/>
						)}
						<DetailRow label="Commission" value={formatCatalogCommission(item.commission_eligible)} />
						<DetailRow label="Sort order" value={String(item.sort_order ?? '—')} />
						<DetailRow
							label="Description"
							value={item.description?.trim() ? item.description : '—'}
						/>
					</Box>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
				<Button variant="contained" onClick={onEdit} disabled={!item}>
					Edit
				</Button>
			</DialogActions>
		</Dialog>
	);
}
