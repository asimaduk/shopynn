'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import MenuItem from '@mui/material/MenuItem';
import { alpha, useTheme } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetPaymentsQuery } from '../../billing/SubscriptionApi';
import OrderPaymentsTable from './OrderPaymentsTable';

export default function OrderPaymentsPage() {
	const theme = useTheme();
	const [query, setQuery] = useState('');
	const [statusTab, setStatusTab] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');
	const [method, setMethod] = useState('all');
	const [sortBy, setSortBy] = useState('created_at');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
	const statusQuery =
		statusTab === 'all'
			? undefined
			: statusTab === 'paid'
				? 'success'
				: statusTab === 'failed'
					? 'failed'
					: 'pending';
	const { data, isLoading } = useGetPaymentsQuery({
		order_only: true,
		order: query || undefined,
		status: statusQuery,
		method: method === 'all' ? undefined : method,
		sort_by: sortBy,
		sort_dir: sortDir
	});
	const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
	const filteredRows = useMemo(() => {
		return rows;
	}, [rows, query, statusTab]);
	const summary = useMemo(() => {
		const totalAmount = filteredRows.reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0);
		const paid = filteredRows.filter((row: any) => ['paid', 'success', 'completed'].includes(String(row?.status || '').toLowerCase())).length;
		const pending = filteredRows.filter((row: any) => String(row?.status || '').toLowerCase() === 'pending').length;
		return { count: filteredRows.length, totalAmount, paid, pending };
	}, [filteredRows]);

	return (
		<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8">
			<div className="flex grow-0 flex-col justify-between gap-4 py-6 sm:flex-row sm:items-start sm:py-8">
				<motion.span initial={{ x: -20 }} animate={{ x: 0, transition: { delay: 0.2 } }} className="min-w-0 flex-1">
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
								bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.22 : 0.14),
								color: 'success.main'
							}}
						>
							<FuseSvgIcon size={24}>heroicons-outline:banknotes</FuseSvgIcon>
						</Box>
						<div className="min-w-0">
							<Typography component="h1" className="text-4xl font-extrabold leading-none tracking-tight">
								Order Payments
							</Typography>
							<Typography variant="body2" color="text.secondary" className="mt-1">
								Payments linked to customer orders (card, mobile money, cash).
							</Typography>
						</div>
					</div>
				</motion.span>

				<motion.div
					className="flex shrink-0 items-center gap-2 self-stretch sm:self-center"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<Button
						component={NavLinkAdapter}
						to="/trading/order-settlements"
						variant="outlined"
						size="medium"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:building-library</FuseSvgIcon>}
						sx={{ textTransform: 'none', fontWeight: 600, px: 2, whiteSpace: 'nowrap' }}
					>
						Settlements
					</Button>
					<Button
						variant="outlined"
						size="medium"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-path</FuseSvgIcon>}
						onClick={() => window.location.reload()}
						sx={{ textTransform: 'none', fontWeight: 600, px: 2, whiteSpace: 'nowrap' }}
					>
						Refresh
					</Button>
				</motion.div>
			</div>

			<Paper elevation={0} className="mb-6 overflow-hidden shadow-sm" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, minmax(0, 1fr))' },
						gap: 2,
						p: 2.5
					}}
				>
					<Typography variant="body2"><strong>Rows:</strong> {summary.count}</Typography>
					<Typography variant="body2"><strong>Paid:</strong> {summary.paid}</Typography>
					<Typography variant="body2"><strong>Pending:</strong> {summary.pending}</Typography>
					<Typography variant="body2"><strong>Total:</strong> GHS {summary.totalAmount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
				</Box>
				<Divider />
				<Box sx={{ px: 2.5, pt: 1.5 }}>
					<Tabs
						value={statusTab}
						onChange={(_e, value) => setStatusTab(value)}
						variant="scrollable"
						scrollButtons="auto"
						sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
					>
						<Tab value="all" label="All" />
						<Tab value="paid" label="Paid" />
						<Tab value="pending" label="Pending" />
						<Tab value="failed" label="Failed" />
					</Tabs>
				</Box>
				<Divider />
				<Box sx={{ p: 2.5 }}>
					<Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr' } }}>
						<TextField
							fullWidth
							size="small"
							placeholder="Search order number or reference..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<FuseSvgIcon size={18}>heroicons-outline:magnifying-glass</FuseSvgIcon>
									</InputAdornment>
								)
							}}
						/>
						<TextField select size="small" label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
							<MenuItem value="all">All methods</MenuItem>
							<MenuItem value="card">Card</MenuItem>
							<MenuItem value="mobile_money">Mobile money</MenuItem>
							<MenuItem value="cash">Cash</MenuItem>
						</TextField>
						<TextField select size="small" label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
							<MenuItem value="created_at">Date</MenuItem>
							<MenuItem value="amount">Amount</MenuItem>
							<MenuItem value="status">Status</MenuItem>
						</TextField>
						<TextField select size="small" label="Order" value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
							<MenuItem value="desc">Newest first</MenuItem>
							<MenuItem value="asc">Oldest first</MenuItem>
						</TextField>
					</Box>
				</Box>
			</Paper>

			<Paper variant="outlined" className="rounded-xl overflow-hidden" sx={{ borderColor: 'divider' }}>
				{isLoading ? (
					<Box className="p-12">
						<FuseLoading />
					</Box>
				) : filteredRows.length === 0 ? (
					<Box className="p-12">
						<Typography color="text.secondary">No order payments found.</Typography>
					</Box>
				) : (
					<OrderPaymentsTable rows={filteredRows} />
				)}
			</Paper>
		</Box>
	);
}
