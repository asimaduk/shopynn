'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useNavigate from '@fuse/hooks/useNavigate';
import PermissionGate from '@auth/PermissionGate';
import { motion } from 'motion/react';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
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

/** Shorter labels for segmented control density */
const SEGMENT_LABELS: Partial<Record<DatePresetId, string>> = {
	all_time: 'All',
	today: 'Today',
	yesterday: 'Yday',
	last_7_days: '7d',
	last_30_days: '30d',
	this_month: 'Month',
	last_month: 'Prev mo',
	custom: 'Custom'
};

export default function ReportDetailView(props: ReportDetailViewProps) {
	const { reportId, title } = props;
	const theme = useTheme();
	const accent = getReportAccentColor(reportId);
	const navigate = useNavigate();
	const isXs = useMediaQuery(theme.breakpoints.down('sm'));
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

	const handlePresetChange = (_: React.MouseEvent<HTMLElement>, next: DatePresetId | null) => {
		if (!next) return;
		if (next === 'custom') {
			setCustomOpen(true);
			return;
		}
		setPreset(next);
	};

	const todayIso = useMemo(() => {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}, []);

	const customRangeInvalid =
		!customStart ||
		!customEnd ||
		customStart > customEnd ||
		customStart > todayIso ||
		customEnd > todayIso;

	const handleCustomStartChange = (value: string) => {
		const next = value && value > todayIso ? todayIso : value;
		setCustomStart(next);
		if (next && customEnd && customEnd < next) {
			setCustomEnd(next);
		}
	};

	const handleCustomEndChange = (value: string) => {
		let next = value && value > todayIso ? todayIso : value;
		if (next && customStart && next < customStart) {
			next = customStart;
		}
		setCustomEnd(next);
	};

	return (
		<PermissionGate
			requiredPermissions={[...perm]}
			fallback={
				<Typography className="text-secondary p-8">You do not have permission to view this report.</Typography>
			}
		>
			<Box className="w-full h-full flex flex-col px-4 pb-12">
				{/* Header — same pattern as Sales / Purchases */}
				<div className="flex grow-0 flex-1 w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-6 sm:py-8">
					<motion.span
						initial={{ x: -20 }}
						animate={{ x: 0, transition: { delay: 0.2 } }}
					>
						<div>
							<PageBreadcrumb className="mb-2" />
							<Typography className="text-4xl font-extrabold leading-none tracking-tight break-words">
								{title}
							</Typography>
							<Typography variant="body1" color="text.secondary" className="mt-1 font-medium">
								{rangeSummary}
							</Typography>
						</div>
					</motion.span>
					<div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
						<Button
							variant="outlined"
							color="inherit"
							size="medium"
							onClick={() => navigate('/reports')}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
							sx={{ textTransform: 'none', fontWeight: 600 }}
						>
							All reports
						</Button>
						<Button
							variant="outlined"
							color="inherit"
							size="medium"
							disabled={!rows.length}
							onClick={handleExportCsv}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-down-tray</FuseSvgIcon>}
							sx={{ textTransform: 'none', fontWeight: 600 }}
						>
							Export CSV
						</Button>
					</div>
				</div>

				{/* Date toolbar */}
				{showDateControls && (
					<Box className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-5">
						{isXs ? (
							<FormControl size="small" sx={{ minWidth: '100%', flex: 1 }}>
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
								>
									{DATE_PRESET_OPTIONS.map((o) => (
										<MenuItem key={o.id} value={o.id}>
											{o.label}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						) : (
							<ToggleButtonGroup
								size="small"
								exclusive
								value={preset}
								onChange={handlePresetChange}
								sx={{
									flexWrap: 'wrap',
									'& .MuiToggleButton-root': {
										textTransform: 'none',
										px: 1.25,
										py: 0.5,
										fontSize: '0.75rem',
										fontWeight: 600,
										borderColor: theme.palette.divider
									}
								}}
							>
								{DATE_PRESET_OPTIONS.map((o) => (
									<ToggleButton key={o.id} value={o.id}>
										{SEGMENT_LABELS[o.id] ?? o.label}
									</ToggleButton>
								))}
							</ToggleButtonGroup>
						)}
					</Box>
				)}

				<Dialog
					open={customOpen}
					onClose={() => setCustomOpen(false)}
					maxWidth="xs"
					fullWidth
					PaperProps={{ sx: { borderRadius: 2 } }}
				>
					<DialogTitle className="font-semibold pb-2">Custom date range</DialogTitle>
					<DialogContent className="flex flex-col gap-4 pt-2">
						<TextField
							label="Start"
							type="date"
							value={customStart}
							onChange={(e) => handleCustomStartChange(e.target.value)}
							slotProps={{
								inputLabel: { shrink: true },
								htmlInput: {
									max: customEnd && customEnd < todayIso ? customEnd : todayIso
								}
							}}
							fullWidth
							helperText="Cannot be after end or today"
						/>
						<TextField
							label="End"
							type="date"
							value={customEnd}
							onChange={(e) => handleCustomEndChange(e.target.value)}
							slotProps={{
								inputLabel: { shrink: true },
								htmlInput: {
									min: customStart || undefined,
									max: todayIso
								}
							}}
							fullWidth
							helperText="Cannot be before start or after today"
							error={Boolean(customStart && customEnd && customStart > customEnd)}
						/>
					</DialogContent>
					<DialogActions className="px-6 pb-5 gap-2">
						<Button onClick={() => setCustomOpen(false)} color="inherit">
							Cancel
						</Button>
						<Button
							variant="contained"
							onClick={() => {
								if (!customRangeInvalid) {
									setPreset('custom');
									setCustomOpen(false);
								}
							}}
							disabled={customRangeInvalid}
							sx={{ textTransform: 'none' }}
						>
							Apply range
						</Button>
					</DialogActions>
				</Dialog>

				{loading && (
					<Paper
						elevation={0}
						className="rounded-lg border border-dashed flex items-center justify-center min-h-[220px]"
						sx={{ borderColor: 'divider' }}
					>
						<FuseLoading />
					</Paper>
				)}

				{isError && (
					<Paper
						elevation={0}
						className="rounded-lg p-4 mb-4"
						sx={{
							backgroundColor: alpha(theme.palette.error.main, 0.08),
							border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`
						}}
					>
						<Typography color="error" className="font-medium text-sm">
							Could not load this report. Check your permissions and try again.
						</Typography>
					</Paper>
				)}

				{!loading && (
					<>
						{/* KPI strip — no cards */}
						{cards.length > 0 && (
							<Paper
								elevation={0}
								className="mb-4 overflow-hidden"
								sx={{
									border: `1px solid ${theme.palette.divider}`,
									borderRadius: 1.5
								}}
							>
								<Box className="flex flex-wrap">
									{cards.map((c, i) => (
										<Box
											key={c.label}
											className="flex flex-col px-4 py-3 min-w-[140px] flex-1"
											sx={{
												borderLeft:
													i > 0 ? `1px solid ${theme.palette.divider}` : undefined
											}}
										>
											<Typography
												variant="caption"
												className="text-secondary font-semibold uppercase tracking-wide"
											>
												{c.label}
											</Typography>
											<Typography
												variant="h6"
												className="font-bold mt-0.5 break-words tabular-nums"
												sx={{ color: c.color ?? accent, fontSize: '1.15rem' }}
											>
												{c.value}
											</Typography>
										</Box>
									))}
								</Box>
							</Paper>
						)}

						{/* Table panel */}
						<Paper
							elevation={0}
							className="overflow-hidden"
							sx={{
								border: `1px solid ${theme.palette.divider}`,
								borderRadius: 1.5
							}}
						>
							<Box className="px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
								<Typography variant="body2" className="font-semibold">
									Results
								</Typography>
								<Typography variant="caption" className="text-secondary tabular-nums">
									{rows.length} row{rows.length === 1 ? '' : 's'}
								</Typography>
							</Box>
							<Divider />
							{rows.length === 0 ? (
								<Box className="py-12 px-6 text-center">
									<FuseSvgIcon sx={{ color: 'text.secondary', opacity: 0.55, mb: 1 }} size={26}>
										heroicons-outline:table-cells
									</FuseSvgIcon>
									<Typography className="font-semibold text-sm">No rows for this range</Typography>
									<Typography className="text-secondary text-xs mt-1 max-w-sm mx-auto">
										{showDateControls
											? 'Widen the date range or pick a different preset.'
											: 'No data available yet.'}
									</Typography>
								</Box>
							) : (
								<TableContainer sx={{ maxHeight: { xs: 'none', md: 560 } }}>
									<Table size="small" stickyHeader>
										<TableHead>
											<TableRow>
												{tableColumns.map((col) => (
													<TableCell
														key={col}
														sx={{
															fontWeight: 700,
															fontSize: '0.7rem',
															textTransform: 'uppercase',
															letterSpacing: '0.05em',
															bgcolor: theme.palette.background.paper,
															borderBottom: `1px solid ${theme.palette.divider}`,
															py: 1
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
															bgcolor: alpha(
																theme.palette.action.hover,
																theme.palette.mode === 'dark' ? 0.04 : 0.4
															)
														}
													}}
												>
													{tableColumns.map((col) => (
														<TableCell key={col} sx={{ py: 1.25, fontSize: '0.8125rem' }}>
															{String(row[col] ?? '')}
														</TableCell>
													))}
												</TableRow>
											))}
										</TableBody>
									</Table>
								</TableContainer>
							)}
						</Paper>
					</>
				)}
			</Box>
		</PermissionGate>
	);
}
