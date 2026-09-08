'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseLoading from '@fuse/core/FuseLoading';
import {
	useGetBillingCatalogQuery,
	type BillingCatalogItem
} from '../billing/BillingCatalogApi';
import '../billing/BillingCatalogApi';
import BillingCatalogDetailDialog from './BillingCatalogDetailDialog';
import BillingCatalogEditDialog from './BillingCatalogEditDialog';
import { formatCatalogAmount, formatCatalogItemType, formatCatalogCommission } from './billingCatalogFormat';

export default function BillingCatalogAdminPage() {
	const { data, isLoading, refetch } = useGetBillingCatalogQuery({
		grouped: false,
		activeOnly: false
	});
	const items = (data && 'items' in data ? data.items : []) ?? [];

	const [detailItem, setDetailItem] = useState<BillingCatalogItem | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);

	const rows = useMemo(
		() => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
		[items]
	);

	const openDetail = (row: BillingCatalogItem) => {
		setDetailItem(row);
		setDetailOpen(true);
		setEditOpen(false);
	};

	const closeDetail = () => {
		setDetailOpen(false);
		setDetailItem(null);
	};

	const openEditFromDetail = () => {
		setDetailOpen(false);
		setEditOpen(true);
	};

	const closeEdit = () => {
		setEditOpen(false);
		if (detailItem) {
			setDetailOpen(true);
		}
	};

	const handleSaved = () => {
		refetch();
		setEditOpen(false);
		setDetailOpen(false);
		setDetailItem(null);
	};

	if (isLoading) return <FuseLoading />;

	return (
		<Box className="mx-auto max-w-6xl p-6">
			<PageBreadcrumb className="mb-4" />
			<Typography variant="h4" fontWeight={700} className="mb-2">
				Billing catalog
			</Typography>
			<Typography color="text.secondary" className="mb-4">
				Subscription, onboarding, and add-on prices (GHS). Open an item to review details, then edit from
				there. Changes apply to new quotes immediately.
			</Typography>
			<Paper variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Label</TableCell>
							<TableCell>Type</TableCell>
							<TableCell align="right">Amount (GHS)</TableCell>
							<TableCell>Status</TableCell>
							<TableCell>Commission</TableCell>
							<TableCell align="right">Actions</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{rows.map((row) => (
							<TableRow
								key={row.id}
								hover
								sx={{ cursor: 'pointer' }}
								onClick={() => openDetail(row)}
							>
								<TableCell>
									<Typography variant="body2" fontWeight={600}>
										{row.label}
									</Typography>
								</TableCell>
								<TableCell>{formatCatalogItemType(row.item_type)}</TableCell>
								<TableCell align="right">{formatCatalogAmount(row.amount_ghs)}</TableCell>
								<TableCell>
									<Chip
										size="small"
										label={row.is_active ? 'Active' : 'Inactive'}
										color={row.is_active ? 'success' : 'default'}
										variant="outlined"
									/>
								</TableCell>
								<TableCell>
									<Chip size="small" label={formatCatalogCommission(row.commission_eligible)} variant="outlined" />
								</TableCell>
								<TableCell align="right" onClick={(e) => e.stopPropagation()}>
									<Button size="small" variant="outlined" onClick={() => openDetail(row)}>
										View
									</Button>
								</TableCell>
							</TableRow>
						))}
						{rows.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6}>
									<Typography color="text.secondary" className="py-6 text-center">
										No catalog items found.
									</Typography>
								</TableCell>
							</TableRow>
						) : null}
					</TableBody>
				</Table>
			</Paper>

			<BillingCatalogDetailDialog
				open={detailOpen}
				item={detailItem}
				onClose={closeDetail}
				onEdit={openEditFromDetail}
			/>
			<BillingCatalogEditDialog
				open={editOpen}
				item={detailItem}
				onClose={closeEdit}
				onSaved={handleSaved}
			/>
		</Box>
	);
}
