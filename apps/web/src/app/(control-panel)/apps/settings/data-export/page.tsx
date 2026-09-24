'use client';

import { useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../parity/FeatureUnavailable';
import { useLazyRunDataExportQuery } from '../../../parity/ParityApi';

type ExportRow = {
	name?: string;
	sku?: string;
	unit?: string;
	unit_price?: string | number;
	alt_price?: string | number;
	actual_cost?: string | number;
	inventory?: string | number;
	reorder_quantity?: string | number;
};

const COLUMNS: { key: keyof ExportRow; label: string }[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'sku', label: 'SKU' },
	{ key: 'unit', label: 'Unit' },
	{ key: 'unit_price', label: 'Unit price' },
	{ key: 'alt_price', label: 'Alt price' },
	{ key: 'actual_cost', label: 'Cost' },
	{ key: 'inventory', label: 'Stock' },
	{ key: 'reorder_quantity', label: 'Reorder qty' }
];

const INCLUDED = [
	'Product name & SKU',
	'Unit & prices (unit, alt, cost)',
	'Stock on hand',
	'Reorder levels'
];

function csvEscape(value: unknown): string {
	const s = value == null ? '' : String(value);
	if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

function productsToCsv(rows: ExportRow[]): string {
	const lines = [COLUMNS.map((c) => c.label).join(',')];
	for (const row of rows) {
		lines.push(COLUMNS.map((c) => csvEscape(row[c.key])).join(','));
	}
	return lines.join('\n');
}

function unwrapProductRows(payload: unknown): ExportRow[] {
	if (Array.isArray(payload)) return payload as ExportRow[];
	if (payload && typeof payload === 'object') {
		const obj = payload as Record<string, unknown>;
		if (Array.isArray(obj.data)) return obj.data as ExportRow[];
		if (Array.isArray(obj.products)) return obj.products as ExportRow[];
		if (obj.data && typeof obj.data === 'object' && Array.isArray((obj.data as { items?: unknown }).items)) {
			return (obj.data as { items: ExportRow[] }).items;
		}
	}
	return [];
}

function downloadCsv(filename: string, csv: string) {
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

type SectionCardProps = {
	title: string;
	subtitle?: string;
	icon: string;
	children: ReactNode;
};

function SectionCard({ title, subtitle, icon, children }: SectionCardProps) {
	return (
		<Paper
			elevation={0}
			variant="outlined"
			sx={{
				borderRadius: 3,
				overflow: 'hidden',
				borderColor: 'divider'
			}}
		>
			<Box
				className="flex items-start gap-2.5 px-4 py-3 sm:px-5"
				sx={{
					borderBottom: '1px solid',
					borderColor: 'divider',
					bgcolor: (theme) =>
						alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.85)
				}}
			>
				<Box
					className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
					sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1) }}
				>
					<FuseSvgIcon size={20} color="primary">
						{icon}
					</FuseSvgIcon>
				</Box>
				<Box className="min-w-0">
					<Typography variant="subtitle1" fontWeight={700}>
						{title}
					</Typography>
					{subtitle ? (
						<Typography variant="body2" color="text.secondary" className="mt-0.5">
							{subtitle}
						</Typography>
					) : null}
				</Box>
			</Box>
			<Box className="p-4 sm:p-5">{children}</Box>
		</Paper>
	);
}

export default function DataExportPage() {
	const [fetchExport, { isFetching }] = useLazyRunDataExportQuery();
	const [lastCount, setLastCount] = useState<number | null>(null);
	const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

	const handleExport = async () => {
		setStatus(null);
		try {
			const result = await fetchExport().unwrap();
			const rows = unwrapProductRows(result);
			if (!rows.length) {
				setLastCount(0);
				setStatus({
					type: 'info',
					text: 'No products to export yet. Add products in Inventory first.'
				});
				return;
			}
			const stamp = new Date().toISOString().slice(0, 10);
			downloadCsv(`shopynn-products-${stamp}.csv`, productsToCsv(rows));
			setLastCount(rows.length);
			setStatus({
				type: 'success',
				text: `Downloaded CSV with ${rows.length} product${rows.length === 1 ? '' : 's'}.`
			});
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; message?: string };
			setStatus({
				type: 'error',
				text: err?.data?.message || err?.message || 'Could not export products. Check your connection and permissions.'
			});
		}
	};

	return (
		<PermissionGate
			featureFlag="dataExportBackup"
			requiredPermissions={['data_export.view', 'data_export.run']}
			fallback={
				<FeatureUnavailable
					title="Export products"
					message="Feature is disabled or you do not have access."
				/>
			}
		>
			<Box className="flex flex-col gap-4">
				<Typography variant="body2" color="text.secondary" className="max-w-2xl">
					Download your live product catalog as a spreadsheet you can open in Excel or Google Sheets.
				</Typography>

				<SectionCard
					title="Product catalog CSV"
					subtitle="Exports every product for this business — name, SKU, unit, prices, cost, stock, and reorder levels."
					icon="heroicons-outline:table-cells"
				>
					<Box className="flex flex-wrap gap-1.5 mb-4">
						{INCLUDED.map((label) => (
							<Chip
								key={label}
								size="small"
								label={label}
								variant="outlined"
								sx={{ borderRadius: 2 }}
							/>
						))}
					</Box>

					<Box className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<Box>
							{lastCount != null ? (
								<Typography variant="body2" color="text.secondary">
									Last export: <strong>{lastCount}</strong> product{lastCount === 1 ? '' : 's'}
								</Typography>
							) : (
								<Typography variant="body2" color="text.secondary">
									File downloads to your computer when ready.
								</Typography>
							)}
						</Box>
						<Button
							variant="contained"
							color="primary"
							size="large"
							disabled={isFetching}
							onClick={handleExport}
							startIcon={
								<FuseSvgIcon size={20}>
									{isFetching ? 'heroicons-outline:arrow-path' : 'heroicons-outline:arrow-down-tray'}
								</FuseSvgIcon>
							}
							sx={{ minWidth: 160, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
						>
							{isFetching ? 'Preparing…' : 'Export CSV'}
						</Button>
					</Box>

					{status ? (
						<Alert severity={status.type} className="mt-4" sx={{ borderRadius: 2 }}>
							{status.text}
						</Alert>
					) : null}
				</SectionCard>

				<Paper
					elevation={0}
					variant="outlined"
					className="flex items-start gap-2.5 p-3.5"
					sx={{ borderRadius: 2.5, borderColor: 'divider', bgcolor: 'background.default' }}
				>
					<FuseSvgIcon size={18} color="disabled" className="mt-0.5 shrink-0">
						heroicons-outline:information-circle
					</FuseSvgIcon>
					<Typography variant="body2" color="text.secondary">
						This exports your product catalog only. Sales, purchases, and a full business restore are not
						available yet.
					</Typography>
				</Paper>
			</Box>
		</PermissionGate>
	);
}
