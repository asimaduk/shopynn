'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useNavigate from '@fuse/hooks/useNavigate';
import PermissionGate from '@auth/PermissionGate';
import {
	useGetAdjustmentsSummaryQuery,
	useGetAuditLogsForRangeQuery,
	useGetCustomersReportQuery,
	useGetProfitAndLossQuery,
	useGetPurchasesSuppliersSummaryQuery,
	useGetSalesSummaryQuery,
	useGetStockSummaryQuery,
	useGetTopProductsQuery,
	useGetTransfersSummaryQuery,
	useGetUsersSummaryQuery
} from './ReportsApi';
import { DATE_PRESET_OPTIONS, DatePresetId, getApiDateRange } from './reportDateRange';
import { getReportAccentColor } from './reportSections';
import {
	mapAdjustments,
	mapAuditLogs,
	mapCustomersReport,
	mapProfitLoss,
	mapPurchasesSuppliers,
	mapSalesSummary,
	mapStaffReport,
	mapStockSummary,
	mapTopProducts,
	mapTransfers,
	type ReportCard,
	type ReportRow
} from './reportMappers';

type ReportDetailViewProps = {
	reportId: string;
	title: string;
};

function useReportRows(
	reportId: string,
	dateArg: { startDate: string; endDate: string } | undefined
): { cards: ReportCard[]; rows: ReportRow[]; loading: boolean; isError: boolean } {
	const skipPl = reportId !== 'profit-loss';
	const skipStock = reportId !== 'stock-summary';
	const skipSales = reportId !== 'sales-summary';
	const skipTop = reportId !== 'top-products';
	const skipCust = reportId !== 'sales-by-customer';
	const skipStaff = reportId !== 'sales-by-staff';
	const skipPur = reportId !== 'purchase-summary';
	const skipTr = reportId !== 'transfers';
	const skipAdj = reportId !== 'adjustments';
	const skipAudit = reportId !== 'audit-trail';

	const pl = useGetProfitAndLossQuery(dateArg, { skip: skipPl });
	const stock = useGetStockSummaryQuery(undefined, { skip: skipStock });
	const sales = useGetSalesSummaryQuery(dateArg, { skip: skipSales });
	const top = useGetTopProductsQuery(dateArg, { skip: skipTop });
	const cust = useGetCustomersReportQuery(dateArg, { skip: skipCust });
	const staff = useGetUsersSummaryQuery(dateArg, { skip: skipStaff });
	const pur = useGetPurchasesSuppliersSummaryQuery(dateArg, { skip: skipPur });
	const tr = useGetTransfersSummaryQuery(dateArg, { skip: skipTr });
	const adj = useGetAdjustmentsSummaryQuery(dateArg, { skip: skipAdj });
	const audit = useGetAuditLogsForRangeQuery(dateArg, { skip: skipAudit });

	return useMemo(() => {
		switch (reportId) {
			case 'profit-loss':
				return {
					...mapProfitLoss(pl.data),
					loading: pl.isLoading || pl.isFetching,
					isError: pl.isError
				};
			case 'stock-summary':
				return {
					...mapStockSummary(stock.data),
					loading: stock.isLoading || stock.isFetching,
					isError: stock.isError
				};
			case 'sales-summary':
				return {
					...mapSalesSummary(sales.data),
					loading: sales.isLoading || sales.isFetching,
					isError: sales.isError
				};
			case 'top-products':
				return {
					...mapTopProducts(top.data),
					loading: top.isLoading || top.isFetching,
					isError: top.isError
				};
			case 'sales-by-customer':
				return {
					...mapCustomersReport(cust.data),
					loading: cust.isLoading || cust.isFetching,
					isError: cust.isError
				};
			case 'sales-by-staff':
				return {
					...mapStaffReport(staff.data),
					loading: staff.isLoading || staff.isFetching,
					isError: staff.isError
				};
			case 'purchase-summary':
				return {
					...mapPurchasesSuppliers(pur.data),
					loading: pur.isLoading || pur.isFetching,
					isError: pur.isError
				};
			case 'transfers':
				return {
					...mapTransfers(tr.data),
					loading: tr.isLoading || tr.isFetching,
					isError: tr.isError
				};
			case 'adjustments':
				return {
					...mapAdjustments(adj.data),
					loading: adj.isLoading || adj.isFetching,
					isError: adj.isError
				};
			case 'audit-trail':
				return {
					...mapAuditLogs(audit.data),
					loading: audit.isLoading || audit.isFetching,
					isError: audit.isError
				};
			default:
				return { cards: [], rows: [], loading: false, isError: false };
		}
	}, [
		reportId,
		pl.data,
		pl.isLoading,
		pl.isFetching,
		pl.isError,
		stock.data,
		stock.isLoading,
		stock.isFetching,
		stock.isError,
		sales.data,
		sales.isLoading,
		sales.isFetching,
		sales.isError,
		top.data,
		top.isLoading,
		top.isFetching,
		top.isError,
		cust.data,
		cust.isLoading,
		cust.isFetching,
		cust.isError,
		staff.data,
		staff.isLoading,
		staff.isFetching,
		staff.isError,
		pur.data,
		pur.isLoading,
		pur.isFetching,
		pur.isError,
		tr.data,
		tr.isLoading,
		tr.isFetching,
		tr.isError,
		adj.data,
		adj.isLoading,
		adj.isFetching,
		adj.isError,
		audit.data,
		audit.isLoading,
		audit.isFetching,
		audit.isError
	]);
}

function datePresetLabel(preset: DatePresetId): string {
	return DATE_PRESET_OPTIONS.find((o) => o.id === preset)?.label ?? preset;
}

export default function ReportDetailView(props: ReportDetailViewProps) {
	const { reportId, title } = props;
	const theme = useTheme();
	const accent = getReportAccentColor(reportId);
	const navigate = useNavigate();
	const [preset, setPreset] = useState<DatePresetId>('all_time');
	const [customOpen, setCustomOpen] = useState(false);
	const [customStart, setCustomStart] = useState('');
	const [customEnd, setCustomEnd] = useState('');

	const dateArg = useMemo(() => {
		if (reportId === 'stock-summary') return undefined;
		if (preset === 'custom') {
			if (!customStart || !customEnd) return undefined;
			return getApiDateRange('custom', new Date(customStart), new Date(customEnd));
		}
		return getApiDateRange(preset);
	}, [reportId, preset, customStart, customEnd]);

	const { cards, rows, loading, isError } = useReportRows(reportId, dateArg);

	const tableColumns = useMemo(() => {
		if (!rows.length) return [] as string[];
		return Object.keys(rows[0] as object);
	}, [rows]);

	const handleExportCsv = () => {
		if (!rows.length || !tableColumns.length) return;
		const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
		const header = tableColumns.map(esc).join(',');
		const lines = rows.map((row) =>
			tableColumns.map((c) => esc(String(row[c] ?? ''))).join(',')
		);
		const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${reportId}-report.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const perm =
		reportId === 'audit-trail' ? (['audit_logs.view', 'audit.view'] as const) : (['reports.view'] as const);

	const showDateControls = reportId !== 'stock-summary';
	const rangeSummary = showDateControls
		? preset === 'custom' && customStart && customEnd
			? `${customStart} → ${customEnd}`
			: preset === 'all_time'
				? 'All time'
				: datePresetLabel(preset)
		: 'Current inventory snapshot';

	return (
		<PermissionGate
			requiredPermissions={[...perm]}
			fallback={
				<Typography className="text-secondary p-8">You do not have permission to view this report.</Typography>
			}
		>
			<Box className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-12">
				{/* Hero */}
				<Paper
					elevation={0}
					className="overflow-hidden rounded-2xl mb-6 sm:mb-8"
					sx={{
						background:
							theme.palette.mode === 'dark'
								? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(accent, 0.12)} 100%)`
								: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(accent, 0.08)} 100%)`,
						border: `1px solid ${alpha(accent, 0.22)}`
					}}
				>
					<Box className="px-5 py-6 sm:px-8 sm:py-8">
						<Box className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
							<Box className="flex flex-col sm:flex-row sm:items-start gap-4 min-w-0">
								<Button
									variant="outlined"
									color="inherit"
									onClick={() => navigate('/reports')}
									startIcon={<FuseSvgIcon size={20}>heroicons-outline:arrow-left</FuseSvgIcon>}
									sx={{
										borderRadius: 2,
										borderColor: alpha(theme.palette.divider, 0.9),
										bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.15 : 0.85),
										flexShrink: 0
									}}
								>
									Reports
								</Button>
								<Box className="min-w-0">
									<Typography
										variant="overline"
										className="tracking-widest font-semibold block mb-1"
										sx={{ color: accent }}
									>
										Report detail
									</Typography>
									<Typography variant="h4" className="font-bold tracking-tight break-words">
										{title}
									</Typography>
									<Typography className="text-secondary mt-2 text-sm sm:text-base max-w-xl">
										Adjust the date range when available, review KPIs, then explore the table below. Export
										as CSV for spreadsheets.
									</Typography>
								</Box>
							</Box>
							<Chip
								size="medium"
								label={rangeSummary}
								sx={{
									alignSelf: 'flex-start',
									fontWeight: 600,
									border: `1px solid ${alpha(accent, 0.35)}`,
									bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.15 : 0.1),
									color: 'text.primary'
								}}
							/>
						</Box>

						{/* Toolbar */}
						<Box
							className="mt-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 pt-6"
							sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}
						>
							{showDateControls && (
								<FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
									<InputLabel id="report-date-preset">Date range</InputLabel>
									<Select<DatePresetId>
										labelId="report-date-preset"
										label="Date range"
										value={preset}
										onChange={(e) => {
											const v = e.target.value as DatePresetId;
											if (v === 'custom') {
												setCustomOpen(true);
												return;
											}
											setPreset(v);
										}}
										sx={{ borderRadius: 2 }}
									>
										{DATE_PRESET_OPTIONS.map((o) => (
											<MenuItem key={o.id} value={o.id}>
												{o.label}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							)}
							<Button
								variant="contained"
								color="secondary"
								size="medium"
								disabled={!rows.length}
								onClick={handleExportCsv}
								startIcon={<FuseSvgIcon size={20}>heroicons-outline:arrow-down-tray</FuseSvgIcon>}
								sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
							>
								Export CSV
							</Button>
						</Box>
					</Box>
				</Paper>

				<Dialog
					open={customOpen}
					onClose={() => setCustomOpen(false)}
					maxWidth="xs"
					fullWidth
					PaperProps={{ sx: { borderRadius: 3 } }}
				>
					<DialogTitle className="font-semibold pb-2">Custom date range</DialogTitle>
					<DialogContent className="flex flex-col gap-20 pt-2">
						<TextField
							label="Start"
							type="date"
							value={customStart}
							onChange={(e) => setCustomStart(e.target.value)}
							slotProps={{ inputLabel: { shrink: true } }}
							fullWidth
						/>
						<TextField
							label="End"
							type="date"
							value={customEnd}
							onChange={(e) => setCustomEnd(e.target.value)}
							slotProps={{ inputLabel: { shrink: true } }}
							fullWidth
						/>
					</DialogContent>
					<DialogActions className="px-6 pb-5 gap-2">
						<Button onClick={() => setCustomOpen(false)} color="inherit">
							Cancel
						</Button>
						<Button
							variant="contained"
							onClick={() => {
								if (customStart && customEnd) {
									setPreset('custom');
									setCustomOpen(false);
								}
							}}
							disabled={!customStart || !customEnd}
							sx={{ borderRadius: 2, textTransform: 'none' }}
						>
							Apply range
						</Button>
					</DialogActions>
				</Dialog>

				{loading && (
					<Paper elevation={0} className="rounded-2xl border border-dashed flex items-center justify-center min-h-[280px]">
						<FuseLoading />
					</Paper>
				)}

				{isError && (
					<Paper
						elevation={0}
						className="rounded-2xl p-6 mb-6"
						sx={{ backgroundColor: alpha(theme.palette.error.main, 0.1), border: `1px solid ${alpha(theme.palette.error.main, 0.25)}` }}
					>
						<Typography color="error" className="font-medium">
							Could not load this report. Check your permissions and try again.
						</Typography>
					</Paper>
				)}

				{!loading && (
					<>
						{cards.length > 0 && (
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mb-8">
								{cards.map((c) => (
									<Card
										key={c.label}
										elevation={0}
										className="overflow-hidden transition-shadow duration-200"
										sx={{
											border: `1px solid ${theme.palette.divider}`,
											borderRadius: 2,
											'&:hover': {
												boxShadow: `0 8px 24px -8px ${alpha(accent, 0.35)}`,
												borderColor: alpha(accent, 0.35)
											}
										}}
									>
										<Box sx={{ borderLeft: `4px solid ${c.color ?? accent}` }}>
											<CardContent className="p-20">
												<Typography variant="caption" className="text-secondary font-semibold uppercase tracking-wide">
													{c.label}
												</Typography>
												<Typography variant="h5" className="font-bold mt-8 break-words" sx={{ color: c.color ?? accent }}>
													{c.value}
												</Typography>
											</CardContent>
										</Box>
									</Card>
								))}
							</div>
						)}

						<Paper
							elevation={0}
							className="rounded-2xl overflow-hidden"
							sx={{
								border: `1px solid ${theme.palette.divider}`,
								background:
									theme.palette.mode === 'dark'
										? alpha(theme.palette.background.paper, 0.5)
										: theme.palette.background.paper
							}}
						>
							<Box
								className="px-5 py-4 sm:px-6 flex items-center justify-between gap-4"
								sx={{
									borderBottom: `1px solid ${theme.palette.divider}`,
									background: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06)
								}}
							>
								<Typography variant="subtitle1" className="font-bold">
									Data
								</Typography>
								<Typography variant="caption" className="text-secondary tabular-nums">
									{rows.length} row{rows.length === 1 ? '' : 's'}
								</Typography>
							</Box>
							<TableContainer sx={{ maxHeight: { xs: 'none', md: 560 } }}>
								<Table size="small" stickyHeader>
									<TableHead>
										<TableRow>
											{tableColumns.map((col) => (
												<TableCell
													key={col}
													sx={{
														fontWeight: 700,
														fontSize: '0.75rem',
														textTransform: 'uppercase',
														letterSpacing: '0.06em',
														bgcolor: alpha(theme.palette.background.default, 0.65),
														borderBottom: `2px solid ${alpha(accent, 0.22)}`
													}}
												>
													{col}
												</TableCell>
											))}
										</TableRow>
									</TableHead>
									<TableBody>
										{rows.map((row, idx) => (
											<TableRow
												key={idx}
												hover
												sx={{
													'&:nth-of-type(even)': {
														bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.04 : 0.03)
													}
												}}
											>
												{tableColumns.map((col) => (
													<TableCell key={col} sx={{ py: 1.75, fontSize: '0.875rem' }}>
														{String(row[col] ?? '')}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
							{rows.length === 0 && (
								<Box className="py-16 px-6 text-center">
									<Box
										className="inline-flex rounded-full items-center justify-center mb-4"
										sx={{
											width: 56,
											height: 56,
											bgcolor: alpha(accent, 0.1)
										}}
									>
										<FuseSvgIcon sx={{ color: 'text.secondary', opacity: 0.7 }} size={28}>
											heroicons-outline:table-cells
										</FuseSvgIcon>
									</Box>
									<Typography className="font-semibold">No rows for this range</Typography>
									<Typography className="text-secondary text-sm mt-2 max-w-sm mx-auto">
										Try widening the date range or pick a different preset.
									</Typography>
								</Box>
							)}
						</Paper>
					</>
				)}
			</Box>
		</PermissionGate>
	);
}
