'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import toast from 'react-hot-toast';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseLoading from '@fuse/core/FuseLoading';
import {
	useGetBillingCatalogQuery,
	useUpdateBillingCatalogItemMutation,
	type BillingCatalogItem
} from '../billing/BillingCatalogApi';
import '../billing/BillingCatalogApi';

export default function BillingCatalogAdminPage() {
	const { data, isLoading, refetch } = useGetBillingCatalogQuery({ grouped: false });
	const [updateItem, { isLoading: saving }] = useUpdateBillingCatalogItemMutation();
	const items = (data && 'items' in data ? data.items : []) ?? [];
	const [edits, setEdits] = useState<Record<string, string>>({});

	const rows = useMemo(
		() => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
		[items]
	);

	const getEditAmount = (row: BillingCatalogItem) =>
		edits[row.id] !== undefined ? edits[row.id] : String(row.amount_ghs);

	const handleSave = async (row: BillingCatalogItem) => {
		const raw = getEditAmount(row);
		const amount_ghs = Number(raw);
		if (!Number.isFinite(amount_ghs) || amount_ghs < 0) {
			toast.error('Enter a valid amount.');
			return;
		}
		try {
			await updateItem({ id: row.id, body: { amount_ghs } }).unwrap();
			toast.success('Saved.');
			setEdits((e) => {
				const next = { ...e };
				delete next[row.id];
				return next;
			});
			refetch();
		} catch (err: any) {
			toast.error(err?.data?.message || 'Save failed');
		}
	};

	if (isLoading) return <FuseLoading />;

	return (
		<Box className="mx-auto max-w-6xl p-6">
			<PageBreadcrumb className="mb-4" />
			<Typography variant="h4" fontWeight={700} className="mb-2">
				Billing catalog
			</Typography>
			<Typography color="text.secondary" className="mb-4">
				Subscription, onboarding, and add-on prices (GHS). Changes apply to new quotes immediately.
			</Typography>
			<Paper variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							{/* <TableCell>Code</TableCell>
							<TableCell>Type</TableCell> */}
							<TableCell>Plan</TableCell>
							<TableCell>Label</TableCell>
							<TableCell align="right">Amount (GHS)</TableCell>
							<TableCell>Commission</TableCell>
							<TableCell align="right">Actions</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.id}>
								{/* <TableCell>
									<Typography variant="caption" fontFamily="monospace">
										{row.code}
									</Typography>
								</TableCell>
								<TableCell>{row.item_type}</TableCell> */}
								<TableCell>{row.plan_tier || '—'}</TableCell>
								<TableCell>{row.label}</TableCell>
								<TableCell align="right" sx={{ minWidth: 140 }}>
									<TextField
										size="small"
										type="number"
										inputProps={{ min: 0, step: 0.01 }}
										value={getEditAmount(row)}
										onChange={(e) =>
											setEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
										}
									/>
								</TableCell>
								<TableCell>
									<Chip size="small" label={row.commission_eligible} variant="outlined" />
								</TableCell>
								<TableCell align="right">
									<Button
										size="small"
										variant="contained"
										disabled={saving}
										onClick={() => handleSave(row)}
									>
										Save
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Paper>
		</Box>
	);
}
