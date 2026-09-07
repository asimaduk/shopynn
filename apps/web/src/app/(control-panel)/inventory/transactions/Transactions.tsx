'use client';

/**
 * Product transactions — parity with `cheqstock/src/containers/home/product_transactions.js`
 * (`GET /transactions` + date range, type filter, search, export).
 */

import { useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
	useListProductTransactionsQuery,
	type ListProductTransactionsArg,
	type ProductTransaction
} from '../ECommerceApi';
import TransactionsTable from './TransactionsTable';
import {
	DATE_RANGE_PRESETS,
	type DateRangePreset,
	formatDateYmd,
	getDateRangeBounds,
	getDateRangeLabel
} from './transactionDateRange';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';

function rowKind(t: ProductTransaction): 'sale' | 'stock_in' {
	return Number(t.type) === 0 ? 'sale' : 'stock_in';
}

export default function Transactions() {
	const theme = useTheme();
	const searchParams = useSearchParams();
	const productSlug = searchParams.get('product') || '';
	const productId = searchParams.get('product_id') || '';
	const productName = searchParams.get('name') || '';

	const [datePreset, setDatePreset] = useState<DateRangePreset>('last_7_days');
	const [customStart, setCustomStart] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 6);
		return d;
	});
	const [customEnd, setCustomEnd] = useState(() => new Date());
	const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'stock_in'>('all');
	const [search, setSearch] = useState('');

	const { startDate: startDateVal, endDate: endDateVal } = useMemo(
		() => getDateRangeBounds(datePreset, customStart, customEnd),
		[datePreset, customStart, customEnd]
	);
	const startDateStr = formatDateYmd(startDateVal);
	const endDateStr = formatDateYmd(endDateVal);

	const queryArg = useMemo<ListProductTransactionsArg>(
		() => ({
			// product: productSlug || undefined,
			startDate: startDateStr,
			endDate: endDateStr,
			type: typeFilter,
			product_id: productId
		}),
		[productSlug, startDateStr, endDateStr, typeFilter, productId]
	);

	const { data: rawRows = [], isLoading, isFetching, refetch } = useListProductTransactionsQuery(queryArg, {refetchOnFocus: true});

	const filteredRows = useMemo(() => {
		let rows = rawRows;
		if (typeFilter !== 'all') {
			rows = rows.filter((t) => rowKind(t) === typeFilter);
		}
		const q = search.trim().toLowerCase();
		if (q) {
			rows = rows.filter((t) => {
				const name = String(t.name ?? '').toLowerCase();
				const user = `${t.first_name ?? ''} ${t.last_name ?? ''}`.toLowerCase();
				const inv = String(t.invoice_number ?? '').toLowerCase();
				return name.includes(q) || user.includes(q) || inv.includes(q);
			});
		}
		return rows;
	}, [rawRows, typeFilter, search]);

	const summary = useMemo(() => {
		const sales = filteredRows.filter((t) => rowKind(t) === 'sale');
		const stockIn = filteredRows.filter((t) => rowKind(t) === 'stock_in');
		const sumAmount = (list: ProductTransaction[]) =>
			list.reduce((s, t) => s + Number(t.quantity ?? 0) * Number(t.unit_price ?? 0), 0);
		return {
			count: filteredRows.length,
			salesCount: sales.length,
			stockInCount: stockIn.length,
			salesTotal: sumAmount(sales),
			stockInTotal: sumAmount(stockIn)
		};
	}, [filteredRows]);

	const onPresetChange = useCallback((e: SelectChangeEvent<DateRangePreset>) => {
		setDatePreset(e.target.value as DateRangePreset);
	}, []);

	const handleExportExcel = useCallback(() => {
		if (!filteredRows.length) {
			toast.error('No transactions to export.');
			return;
		}
		const ws = XLSX.utils.json_to_sheet(
			filteredRows.map((p) => ({
				Type: rowKind(p) === 'stock_in' ? 'Stock In' : 'Sale',
				Name: p.name,
				QTY: p.quantity,
				'Unit price': p.unit_price,
				Total: (Number(p.quantity ?? 0) * Number(p.unit_price ?? 0)).toFixed(2),
				Store: p.warehouse,
				'Done by': `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
				Date: p.created_at,
				Invoice: p.invoice_number
			}))
		);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
		XLSX.writeFile(wb, `Product_transactions_${startDateStr}_${endDateStr}.xlsx`);
	}, [filteredRows, startDateStr, endDateStr]);

	const busy = isLoading || isFetching;

	return (
		<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8">
			{/* Page title — aligned with Stock count / Adjustments */}
			<div className="flex grow-0 flex-col justify-between gap-4 py-6 sm:flex-row sm:items-start sm:py-8">
				<motion.span
					initial={{ x: -20 }}
					animate={{ x: 0, transition: { delay: 0.2 } }}
					className="min-w-0 flex-1"
				>
					<PageBreadcrumb className="mb-2" />
					<div className="flex items-start gap-3">
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: 44,
								height: 44,
								borderRadius: 2,
								flexShrink: 0,
								bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.14),
								color: 'primary.main'
							}}
						>
							<FuseSvgIcon size={24}>heroicons-outline:arrows-right-left</FuseSvgIcon>
						</Box>
						<div className="min-w-0">
							<Typography component="h1" className="text-4xl font-extrabold leading-none tracking-tight">
								Item transactions
							</Typography>
							<Typography variant="body2" color="text.secondary" className="mt-1">
								{productName ? (
									<>
										Filtered by item · <strong>{productName}</strong>
									</>
								) : (
									'Sales and stock movements in the selected range'
								)}
							</Typography>
						</div>
					</div>
				</motion.span>
				<motion.div
					className="flex shrink-0 items-center gap-2 self-stretch sm:self-center"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<IconButton
						aria-label="Refresh"
						onClick={() => refetch()}
						disabled={busy}
						size="small"
						sx={{
							bgcolor: alpha(theme.palette.background.paper, 0.8),
							border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
							'&:hover': { bgcolor: alpha(theme.palette.background.paper, 1) }
						}}
					>
						<FuseSvgIcon className={busy ? 'animate-spin' : ''} size={18}>
							heroicons-outline:arrow-path
						</FuseSvgIcon>
					</IconButton>
					<Button
						variant="contained"
						color="secondary"
						size="medium"
						disableElevation
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:cloud-arrow-down</FuseSvgIcon>}
						onClick={handleExportExcel}
						disabled={!filteredRows.length}
						sx={{ textTransform: 'none', fontWeight: 600, px: 2, whiteSpace: 'nowrap' }}
					>
						Export Excel
					</Button>
				</motion.div>
			</div>

			<Paper
				elevation={0}
				className="mb-6 overflow-hidden shadow-sm"
				sx={{
					border: `1px solid ${theme.palette.divider}`,
					borderRadius: 3
				}}
			>
				{/* Summary — compact stat cards with left accent (softer than full-tint panels) */}
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
						gap: 2,
						p: 2.5,
						background:
							theme.palette.mode === 'dark'
								? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.divider, 0.04)} 100%)`
								: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.grey[100], 0.85)} 100%)`
					}}
				>
					{(
						[
							{
								key: 'rows',
								label: 'Rows (filtered)',
								accent: theme.palette.primary.main,
								muted: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.12),
								primary: String(summary.count),
								secondary: null as string | null
							},
							{
								key: 'sales',
								label: 'Sales',
								accent: theme.palette.warning?.main ?? '#ed6c02',
								muted: alpha(theme.palette.warning?.main ?? '#ed6c02', theme.palette.mode === 'dark' ? 0.2 : 0.1),
								primary: String(summary.salesCount),
								secondary: formatGhsCurrency(Number(summary.salesTotal ?? 0), 2, 2)
							},
							{
								key: 'stock',
								label: 'Stock in',
								accent: theme.palette.success.main,
								muted: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.22 : 0.1),
								primary: String(summary.stockInCount),
								secondary: formatGhsCurrency(Number(summary.stockInTotal ?? 0), 2, 2)
							}
						] as const
					).map((card) => (
						<Box
							key={card.key}
							sx={{
								position: 'relative',
								borderRadius: 2,
								px: 2,
								py: 1.5,
								pl: 2.25,
								overflow: 'hidden',
								backgroundColor: theme.palette.background.paper,
								border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.35 : 0.65)}`,
								boxShadow:
									theme.palette.mode === 'dark'
										? `0 0 0 1px ${alpha(theme.palette.common.white, 0.04)} inset`
										: `0 1px 2px ${alpha(theme.palette.common.black, 0.045)}, 0 4px 14px ${alpha(theme.palette.common.black, 0.04)}`,
								'&::before': {
									content: '""',
									position: 'absolute',
									left: 0,
									top: 0,
									bottom: 0,
									width: 4,
									background: `linear-gradient(180deg, ${card.accent} 0%, ${alpha(card.accent, 0.65)} 100%)`,
									borderRadius: '4px 0 0 4px'
								}
							}}
						>
							<Box
								sx={{
									position: 'absolute',
									right: -20,
									top: -20,
									width: 88,
									height: 88,
									borderRadius: '50%',
									background: card.muted,
									pointerEvents: 'none'
								}}
							/>
							<Box sx={{ position: 'relative' }}>
								<Typography
									variant="caption"
									sx={{
										color: 'text.secondary',
										fontWeight: 700,
										letterSpacing: '0.08em',
										textTransform: 'uppercase',
										fontSize: '0.625rem',
										display: 'block'
									}}
								>
									{card.label}
								</Typography>
								<Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
									<Typography
										variant="h5"
										sx={{
											fontWeight: 800,
											lineHeight: 1.1,
											letterSpacing: '-0.02em',
											color: 'text.primary'
										}}
									>
										{card.primary}
									</Typography>
									{card.secondary ? (
										<Typography
											variant="body2"
											sx={{
												fontWeight: 600,
												color: alpha(theme.palette.text.secondary, 0.95),
												fontFeatureSettings: '"tnum"'
											}}
										>
											{card.secondary}
										</Typography>
									) : null}
								</Box>
							</Box>
						</Box>
					))}
				</Box>

				<Divider />

				{/* Filters */}
				<Box
					sx={{
						display: 'flex',
						flexDirection: { xs: 'column', lg: 'row' },
						flexWrap: 'wrap',
						alignItems: { lg: 'center' },
						gap: 1.5,
						px: 2.5,
						py: 2
					}}
				>
					<FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 176 } }}>
						<InputLabel id="tx-date-preset">Date range</InputLabel>
						<Select<DateRangePreset>
							labelId="tx-date-preset"
							label="Date range"
							value={datePreset}
							onChange={onPresetChange}
						>
							{DATE_RANGE_PRESETS.map((r) => (
								<MenuItem key={r.id} value={r.value}>
									{r.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					{datePreset === 'custom' && (
						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
							<TextField
								size="small"
								label="Start"
								type="date"
								value={formatDateYmd(customStart)}
								onChange={(e) => {
									const nextStart = new Date(e.target.value + 'T12:00:00');
									setCustomStart(nextStart);
									if (nextStart > customEnd) {
										setCustomEnd(nextStart);
									}
								}}
								InputLabelProps={{ shrink: true }}
								inputProps={{ max: formatDateYmd(customEnd) }}
								sx={{ width: 148 }}
							/>
							<TextField
								size="small"
								label="End"
								type="date"
								value={formatDateYmd(customEnd)}
								onChange={(e) => {
									const nextEnd = new Date(e.target.value + 'T12:00:00');
									if (nextEnd < customStart) {
										setCustomEnd(customStart);
										return;
									}
									setCustomEnd(nextEnd);
								}}
								InputLabelProps={{ shrink: true }}
								inputProps={{ min: formatDateYmd(customStart) }}
								sx={{ width: 148 }}
							/>
						</Box>
					)}
					<ToggleButtonGroup
						size="small"
						exclusive
						value={typeFilter}
						onChange={(_, v) => v != null && setTypeFilter(v)}
						aria-label="Transaction type"
						sx={{
							'& .MuiToggleButton-root': {
								px: 1.5,
								textTransform: 'none',
								fontWeight: 500,
								borderColor: alpha(theme.palette.divider, 0.9)
							},
							'& .Mui-selected': {
								bgcolor: alpha(theme.palette.primary.main, 0.14),
								color: 'primary.main',
								fontWeight: 600,
								'&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
							}
						}}
					>
						<ToggleButton value="all">All</ToggleButton>
						<ToggleButton value="sale">Sales</ToggleButton>
						<ToggleButton value="stock_in">Stock in</ToggleButton>
					</ToggleButtonGroup>
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{
							ml: { lg: 'auto' },
							alignSelf: 'center',
							maxWidth: { xs: '100%', lg: 280 },
							textAlign: { xs: 'left', lg: 'right' },
							fontStyle: 'italic'
						}}
					>
						{getDateRangeLabel(datePreset, customStart, customEnd)}
					</Typography>
				</Box>

				<Divider />
			</Paper>

			<Box className="relative min-h-0 flex-1">
				{busy && (
					<Box
						className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20"
						aria-busy
					>
						<CircularProgress />
					</Box>
				)}
				<TransactionsTable transactions={filteredRows.map(t=> ({...t, attendant: t.first_name + ' ' + t.last_name}))} />
			</Box>	
		</Box>
	);
}
