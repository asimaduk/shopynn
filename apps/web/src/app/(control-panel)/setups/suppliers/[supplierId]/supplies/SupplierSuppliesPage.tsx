'use client';

import { useEffect, useState, useMemo } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TableContainer from '@mui/material/TableContainer';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseLoading from '@fuse/core/FuseLoading';
import Link from '@fuse/core/Link';
import DateRangeDialog from '@fuse/core/FuseDateSelection';
import { useParams } from 'next/navigation';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetSupplierQuery } from '../../SupplierApi';
import TradingApi from 'src/app/(control-panel)/trading/TradingApi';
import { store } from 'src/store/store';
import type { Purchase } from 'src/app/(control-panel)/trading/TradingApi';

type DateRange = { startDate: string; endDate: string } | null;

function formatDateRange(dates: DateRange): string {
	if (!dates) return 'All dates';
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const start = new Date(dates.startDate);
	const end = new Date(dates.endDate);
	return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function initialsFromSupplierName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
	}
	if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
	return '?';
}

function parseAmount(raw: string | number | undefined | null): number {
	if (raw == null) return 0;
	const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
	return Number.isFinite(n) ? n : 0;
}

function purchasesStats(list: Purchase[]) {
	let itemSum = 0;
	let amountSum = 0;
	for (const p of list) {
		itemSum += parseInt(String(p.number_of_items ?? 0), 10) || 0;
		amountSum += parseAmount(p.total_amount);
	}
	return { itemSum, amountSum };
}

export default function SupplierSuppliesPage() {
	const { supplierId } = useParams<{ supplierId: string }>();
	const { data: supplier, isLoading: supplierLoading, isError: supplierError } = useGetSupplierQuery(supplierId ?? '', {
		skip: !supplierId
	});

	const [dateRange, setDateRange] = useState<DateRange>(null);
	const [dateDialogOpen, setDateDialogOpen] = useState(false);
	const [purchases, setPurchases] = useState<Purchase[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	const paginatedData = useMemo(
		() => purchases.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
		[purchases, page, rowsPerPage]
	);
	const emptyRows = Math.max(0, rowsPerPage - paginatedData.length);

	const { itemSum, amountSum } = useMemo(() => purchasesStats(purchases), [purchases]);

	const formattedTotalGhs = useMemo(() => {
		if (purchases.length === 0) return null;
		const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountSum);
		return `GHS ${n}`;
	}, [amountSum, purchases.length]);

	useEffect(() => {
		if (!supplierId) return;
		let cancelled = false;
		setLoading(true);
		setPage(0);
		let queryParams = `suppliedBy=${supplierId}`;
		if (dateRange?.startDate && dateRange?.endDate) {
			queryParams += `&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
		}
		store.store
			.dispatch(
				TradingApi.endpoints.getProductPurchasesByDate.initiate(queryParams, {
					forceRefetch: true
				})
			)
			.then((result) => {
				if (!cancelled && result.data) setPurchases(Array.isArray(result.data) ? result.data : []);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [supplierId, dateRange]);

	const handlePageChange = (_: unknown, newPage: number) => setPage(newPage);
	const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setRowsPerPage(parseInt(e.target.value, 10));
		setPage(0);
	};

	if (supplierLoading) return <FuseLoading />;

	if (supplierError || !supplier) {
		return (
			<Box className="px-4 py-12 max-w-lg mx-auto text-center">
				<PageBreadcrumb className="mb-6 text-left" />
				<Paper variant="outlined" className="p-8 rounded-3xl" sx={{ borderColor: 'divider' }}>
					<Box
						className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.12), color: 'error.main' }}
					>
						<FuseSvgIcon size={32}>heroicons-outline:exclamation-circle</FuseSvgIcon>
					</Box>
					<Typography variant="h6" fontWeight={700} gutterBottom>
						Supplier could not be loaded
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mb-6">
						Check the link or return to the supplier list.
					</Typography>
					<Button
						variant="contained"
						color="secondary"
						component={NavLinkAdapter}
						to="/setups/suppliers"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to suppliers
					</Button>
				</Paper>
			</Box>
		);
	}

	const supplierName = supplier.name != null ? String(supplier.name).trim() : 'Supplier';

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full min-h-full pb-12">
				<Box
					className="px-4 sm:px-6 lg:px-10 pt-6 pb-10"
					sx={{
						background: (theme) =>
							`linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.08)} 0%, transparent 72%)`
					}}
				>
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
						className="max-w-5xl mx-auto"
					>
						<PageBreadcrumb className="mb-4" />

						<Paper
							elevation={0}
							sx={{
								borderRadius: 4,
								overflow: 'hidden',
								border: '1px solid',
								borderColor: 'divider',
								bgcolor: 'background.paper',
								boxShadow: (theme) =>
									theme.palette.mode === 'dark'
										? `0 24px 48px ${alpha('#000', 0.35)}`
										: `0 20px 40px ${alpha(theme.palette.common.black, 0.06)}, 0 0 1px ${alpha(theme.palette.common.black, 0.08)}`
							}}
						>
							<Box
								className="px-5 py-7 sm:px-8 sm:py-9"
								sx={{
									background: (theme) =>
										`linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`
								}}
							>
								<Stack
									direction={{ xs: 'column', sm: 'row' }}
									spacing={3}
									alignItems={{ xs: 'flex-start', sm: 'center' }}
									justifyContent="space-between"
								>
									<Stack direction="row" spacing={2.5} alignItems="center">
										<Avatar
											sx={{
												width: 64,
												height: 64,
												fontSize: '1.35rem',
												fontWeight: 800,
												bgcolor: 'primary.main',
												color: 'primary.contrastText',
												boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.35)}`
											}}
										>
											{initialsFromSupplierName(supplierName)}
										</Avatar>
										<Box>
											<Typography className="text-2xl sm:text-3xl font-extrabold tracking-tight" component="h1">
												Recent supplies
											</Typography>
											<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
												Purchase history for {supplierName}
											</Typography>
											<Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 1.5 }}>
												<Chip
													size="small"
													label={`${purchases.length} purchase${purchases.length === 1 ? '' : 's'}`}
													sx={{ fontWeight: 600 }}
													color="default"
													variant="outlined"
												/>
												{!loading && purchases.length > 0 && formattedTotalGhs && (
													<Chip
														size="small"
														label={`Total: ${formattedTotalGhs}`}
														sx={{ fontWeight: 700 }}
														color="secondary"
														variant="outlined"
													/>
												)}
												{dateRange && (
													<Chip size="small" label="Date filter on" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
												)}
											</Stack>
										</Box>
									</Stack>

									<Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
										<Button
											variant="outlined"
											size="medium"
											onClick={() => setDateDialogOpen(true)}
											startIcon={<FuseSvgIcon size={18}>heroicons-outline:calendar-days</FuseSvgIcon>}
											sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
										>
											{formatDateRange(dateRange)}
										</Button>
										{dateRange && (
											<Tooltip title="Clear date filter">
												<Button
													variant="text"
													size="medium"
													color="inherit"
													onClick={() => setDateRange(null)}
													sx={{ borderRadius: 2, fontWeight: 600, minWidth: 0 }}
													startIcon={<FuseSvgIcon size={18}>heroicons-outline:x-mark</FuseSvgIcon>}
												>
													Clear
												</Button>
											</Tooltip>
										)}
										<Button
											variant="contained"
											color="secondary"
											component={NavLinkAdapter}
											to={`/setups/suppliers/${supplierId}/view`}
											size="medium"
											sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
											startIcon={<FuseSvgIcon size={18}>heroicons-outline:building-storefront</FuseSvgIcon>}
										>
											Supplier profile
										</Button>
									</Stack>
								</Stack>
							</Box>

							<Box className="px-4 py-5 sm:px-8 sm:pb-6">
								{!loading && purchases.length > 0 && (
									<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className="mb-5">
										<Paper
											elevation={0}
											variant="outlined"
											sx={{
												flex: 1,
												p: 2,
												borderRadius: 2,
												borderColor: 'divider',
												bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04)
											}}
										>
											<Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.4 }}>
												LINE ITEMS
											</Typography>
											<Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
												{itemSum.toLocaleString()}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Total quantity rows on loaded purchases
											</Typography>
										</Paper>
										<Paper
											elevation={0}
											variant="outlined"
											sx={{
												flex: 1,
												p: 2,
												borderRadius: 2,
												borderColor: 'divider',
												bgcolor: (theme) => alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.1 : 0.06)
											}}
										>
											<Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.4 }}>
												TOTAL AMOUNT
											</Typography>
											<Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, color: 'success.main' }}>
												{formattedTotalGhs ?? '—'}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Sum of purchase totals (same date range and list as below)
											</Typography>
										</Paper>
									</Stack>
								)}

								<Box
									sx={{
										borderRadius: 3,
										overflow: 'hidden',
										border: '1px solid',
										borderColor: 'divider',
										bgcolor: 'background.paper'
									}}
								>
									<Box
										className="flex items-center gap-2 px-4 py-3"
										sx={{
											borderBottom: '1px solid',
											borderColor: 'divider',
											bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.8)
										}}
									>
										<FuseSvgIcon size={22} color="action">heroicons-outline:rectangle-stack</FuseSvgIcon>
										<Typography variant="subtitle1" fontWeight={700}>
											Purchases
										</Typography>
									</Box>
									{loading ? (
										<Box className="flex items-center justify-center py-16">
											<FuseLoading />
										</Box>
									) : (
										<>
											<TableContainer>
												<Table size="medium" sx={{ minWidth: 640 }}>
													<TableHead>
														<TableRow
															sx={{
																'& th': {
																	fontWeight: 700,
																	fontSize: '0.75rem',
																	textTransform: 'uppercase',
																	letterSpacing: '0.06em',
																	color: 'text.secondary',
																	bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
																	borderBottomColor: 'divider'
																}
															}}
														>
															<TableCell>Date</TableCell>
															<TableCell>Invoice #</TableCell>
															<TableCell align="right">Total</TableCell>
															<TableCell align="right">Items</TableCell>
															<TableCell>Receiver</TableCell>
														</TableRow>
													</TableHead>
													<TableBody>
														{paginatedData.length === 0 ? (
															<TableRow>
																<TableCell colSpan={5} align="center" sx={{ py: 0, border: 'none' }}>
																	<Box
																		className="mx-4 my-10 px-6 py-10 rounded-2xl"
																		sx={{
																			border: '2px dashed',
																			borderColor: 'divider',
																			bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.4 : 0.7)
																		}}
																	>
																		<Box
																			className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
																			sx={{
																				bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
																				color: 'primary.main'
																			}}
																		>
																			<FuseSvgIcon size={28}>heroicons-outline:truck</FuseSvgIcon>
																		</Box>
																		<Typography variant="subtitle1" fontWeight={700} gutterBottom>
																			No purchases yet
																		</Typography>
																		<Typography variant="body2" color="text.secondary" className="max-w-sm mx-auto">
																			Stock receipts from this supplier will show up here. Adjust the date range if you expect older records.
																		</Typography>
																	</Box>
																</TableCell>
															</TableRow>
														) : (
															<>
																{paginatedData.map((row) => (
																	<TableRow
																		key={row.id}
																		hover
																		sx={{
																			'&:last-child td': { borderBottom: 0 },
																			transition: 'background-color 0.15s ease'
																		}}
																	>
																		<TableCell sx={{ fontWeight: 500 }}>
																			{row.created_at
																				? new Date(row.created_at).toLocaleDateString(undefined, {
																						month: 'short',
																						day: 'numeric',
																						year: 'numeric'
																					})
																				: '—'}
																		</TableCell>
																		<TableCell>
																			<Typography
																				component={Link}
																				to={`/trading/purchases/${row.id}`}
																				sx={{
																					fontWeight: 600,
																					color: 'primary.main',
																					textDecoration: 'none',
																					'&:hover': { textDecoration: 'underline' }
																				}}
																			>
																				{row.invoice_number ?? '—'}
																			</Typography>
																		</TableCell>
																		<TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
																			{row.total_amount ?? '—'}
																		</TableCell>
																		<TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
																			{row.number_of_items ?? '—'}
																		</TableCell>
																		<TableCell sx={{ color: 'text.secondary' }}>{row.receiver_name ?? '—'}</TableCell>
																	</TableRow>
																))}
																{emptyRows > 0 && (
																	<TableRow style={{ height: 53 * emptyRows }}>
																		<TableCell colSpan={5} />
																	</TableRow>
																)}
															</>
														)}
													</TableBody>
												</Table>
											</TableContainer>
											{purchases.length > 0 && (
												<TablePagination
													component="div"
													count={purchases.length}
													page={page}
													onPageChange={handlePageChange}
													rowsPerPage={rowsPerPage}
													onRowsPerPageChange={handleRowsPerPageChange}
													rowsPerPageOptions={[5, 10, 25]}
													labelRowsPerPage="Rows"
													sx={{
														borderTop: '1px solid',
														borderColor: 'divider',
														'.MuiTablePagination-toolbar': { px: 2 }
													}}
												/>
											)}
										</>
									)}
								</Box>
							</Box>
						</Paper>
					</motion.div>
				</Box>
			</div>
			<DateRangeDialog
				open={dateDialogOpen}
				handleClose={(dates: DateRange) => {
					if (dates) setDateRange(dates);
					setDateDialogOpen(false);
				}}
			/>
		</>
	);
}
