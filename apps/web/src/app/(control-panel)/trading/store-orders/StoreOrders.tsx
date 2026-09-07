'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetStoreOrdersQuery } from '../TradingApi';
import StoreOrdersTable from './StoreOrdersTable';
import * as XLSX from 'xlsx';
import { useGetWarehousesQuery } from '../../setups/warehouses/WarehouseApi';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission, hasPermissionCodes } from '@auth/permissions';
import {
	DATE_RANGE_PRESETS,
	type DateRangePreset,
	formatDateYmd,
	getDateRangeBounds,
	getDateRangeLabel
} from '../../inventory/transactions/transactionDateRange';

// Keep workflow order (for filters + actions) consistent across web/mobile.
const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed', 'cancelled'];

const formatStatusLabel = (value: string) =>
	String(value || '')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateTimeLocal = (d: Date) => {
	const yyyy = d.getFullYear();
	const mm = pad2(d.getMonth() + 1);
	const dd = pad2(d.getDate());
	const hh = pad2(d.getHours());
	const mi = pad2(d.getMinutes());
	const ss = pad2(d.getSeconds());
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
};

const withTime = (d: Date, h: number, m: number, s: number, ms = 0) => {
	const next = new Date(d);
	next.setHours(h, m, s, ms);
	return next;
};

export default function StoreOrders() {
	const theme = useTheme();
	const { data: user } = useUser();
	const [status, setStatus] = useState('');
	const [fulfillmentType, setFulfillmentType] = useState('');
	const [warehouseId, setWarehouseId] = useState('');
	const [datePreset, setDatePreset] = useState<DateRangePreset>('last_7_days');
	const [customStart, setCustomStart] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 6);
		return d;
	});
	const [customEnd, setCustomEnd] = useState(() => new Date());
	const now = new Date();
	const nowLocal = formatDateTimeLocal(now);
	const canMultiStore =
		hasPermissionCodes(user, 'stores.multi_access') &&
		hasFeatureAndPermission(user, 'stores.multi_access', undefined, 'stores.multi_access');
	const canViewOrderPayments = hasFeatureAndPermission(
		user,
		'payments.view',
		undefined,
		'payments.view'
	);
	const userWarehouseId = user?.warehouse?.id || '';
	const effectiveWarehouseId = canMultiStore ? warehouseId : userWarehouseId;
	const { data: warehousesData } = useGetWarehousesQuery(undefined, { skip: !canMultiStore });
	const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

	useEffect(() => {
		if (!canMultiStore && userWarehouseId) {
			setWarehouseId(userWarehouseId);
		}
	}, [canMultiStore, userWarehouseId]);

	const { startDate: startDateVal, endDate: endDateVal } = useMemo(
		() => getDateRangeBounds(datePreset, customStart, customEnd),
		[datePreset, customStart, customEnd]
	);
	const startDate = withTime(startDateVal, 0, 0, 0, 0).toISOString();
	const endDate = withTime(endDateVal, 23, 59, 59, 999).toISOString();

	const { data, isLoading, isFetching, refetch } = useGetStoreOrdersQuery({
		status: status || undefined,
		fulfillment_type: fulfillmentType || undefined,
		warehouse_id: effectiveWarehouseId || undefined,
		startDate: startDate || undefined,
		endDate: endDate || undefined
	});

	const list = useMemo(() => (Array.isArray(data) ? data : data?.items || data?.list || []), [data]);
	const summary = useMemo(() => {
		const completed = list.filter((o: any) => String(o.status || '').toLowerCase() === 'completed');
		const pending = list.filter((o: any) => String(o.status || '').toLowerCase() === 'pending');
		const totalAmount = list.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
		return { count: list.length, pending: pending.length, completed: completed.length, totalAmount };
	}, [list]);

	const busy = isLoading || isFetching;

	const onPresetChange = (e: SelectChangeEvent<DateRangePreset>) => {
		setDatePreset(e.target.value as DateRangePreset);
	};

	const handleExportExcel = () => {
		if (!list.length) return;
		const ws = XLSX.utils.json_to_sheet(
			list.map((order: any) => ({
				Order: order.order_number || order.id,
				Status: formatStatusLabel(String(order.status || '')),
				Payment: formatStatusLabel(String(order.payment_status || 'unpaid')),
				Store: order.warehouse_name || order.warehouse_id || '',
				Total: Number(order.total_amount || 0).toFixed(2),
				Created: order.created_at || '',
				Updated: order.updated_at || ''
			}))
		);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Store Orders');
		const prefix = fulfillmentType === 'delivery' ? 'Delivery_queue' : 'Store_orders';
		XLSX.writeFile(wb, `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
	};

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
								bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.14),
								color: 'primary.main'
							}}
						>
							<FuseSvgIcon size={24}>heroicons-outline:shopping-bag</FuseSvgIcon>
						</Box>
						<div className="min-w-0">
							<Typography component="h1" className="text-4xl font-extrabold leading-none tracking-tight">
								Online Orders
							</Typography>
							<Typography variant="body2" color="text.secondary" className="mt-1">
								Process online customer orders
							</Typography>
						</div>
					</div>
				</motion.span>

				<motion.div
					className="flex shrink-0 items-center gap-2 self-stretch sm:self-center"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					{canViewOrderPayments ? (
						<Button
							component={Link}
							href="/trading/order-payments"
							variant="outlined"
							size="medium"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:banknotes</FuseSvgIcon>}
							sx={{ textTransform: 'none', fontWeight: 600, px: 2, whiteSpace: 'nowrap' }}
						>
							Order Payments
						</Button>
					) : null}
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
						disabled={!list.length}
						sx={{ textTransform: 'none', fontWeight: 600, px: 2, whiteSpace: 'nowrap' }}
					>
						Export Excel
					</Button>
				</motion.div>
			</div>

			<Paper elevation={0} className="mb-6 overflow-hidden shadow-sm" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
				<Box sx={{ px: 2.5, pt: 2 }}>
					<Tabs
						value={fulfillmentType || 'all'}
						onChange={(_e, value) => setFulfillmentType(value === 'all' ? '' : 'delivery')}
						variant="scrollable"
						scrollButtons="auto"
						sx={{ minHeight: 42, '& .MuiTab-root': { minHeight: 42, textTransform: 'none', fontWeight: 600 } }}
					>
						<Tab value="all" label="All Orders" />
						<Tab value="delivery" label="Delivery Queue" />
					</Tabs>
				</Box>
				<Divider />
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, minmax(0, 1fr))' },
						gap: 2,
						p: 2.5
					}}
				>
					<Typography variant="body2"><strong>Rows:</strong> {summary.count}</Typography>
					<Typography variant="body2"><strong>Pending:</strong> {summary.pending}</Typography>
					<Typography variant="body2"><strong>Completed:</strong> {summary.completed}</Typography>
					<Typography variant="body2"><strong>Total:</strong> GHS {Number(summary.totalAmount || 0).toFixed(2)}</Typography>
				</Box>
				<Divider />
				<Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, flexWrap: 'wrap', alignItems: { lg: 'center' }, gap: 1.5, px: 2.5, py: 2 }}>
					{canMultiStore && (
						<TextField select size="small" label="Store" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} sx={{ minWidth: 220 }}>
							<MenuItem value="">All stores</MenuItem>
							{warehouses.map((w: any) => (
								<MenuItem key={w.id} value={w.id}>
									{w.name}
								</MenuItem>
							))}
						</TextField>
					)}
					<TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180 }}>
						{STATUS_OPTIONS.map((s) => (
							<MenuItem key={s || 'all'} value={s}>
								{s ? formatStatusLabel(s) : 'All'}
							</MenuItem>
						))}
					</TextField>
					<FormControl size="small" sx={{ minWidth: 176 }}>
						<InputLabel id="store-orders-date-preset">Date range</InputLabel>
						<Select<DateRangePreset>
							labelId="store-orders-date-preset"
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
						<>
							<TextField
								size="small"
								type="datetime-local"
								label="Start"
								value={formatDateTimeLocal(customStart)}
								onChange={(e) => {
									const nextStart = new Date(e.target.value);
									const capped = nextStart > now ? now : nextStart;
									setCustomStart(capped);
									if (capped > customEnd) setCustomEnd(capped);
								}}
								InputLabelProps={{ shrink: true }}
								inputProps={{ max: formatDateTimeLocal(customEnd > now ? now : customEnd), step: 1 }}
							/>
							<TextField
								size="small"
								type="datetime-local"
								label="End"
								value={formatDateTimeLocal(customEnd)}
								onChange={(e) => {
									const nextEnd = new Date(e.target.value);
									const capped = nextEnd > now ? now : nextEnd;
									if (capped < customStart) {
										setCustomEnd(customStart);
										return;
									}
									setCustomEnd(capped);
								}}
								InputLabelProps={{ shrink: true }}
								inputProps={{ min: formatDateTimeLocal(customStart), max: nowLocal, step: 1 }}
							/>
						</>
					)}
					<Typography variant="caption" color="text.secondary" sx={{ ml: { lg: 'auto' }, alignSelf: 'center' }}>
						{getDateRangeLabel(datePreset, customStart, customEnd)}
					</Typography>
				</Box>
				<Divider />
			</Paper>

			<Box className="relative min-h-0 flex-1">
				{busy && (
					<Box className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20">
						<CircularProgress />
					</Box>
				)}
				<StoreOrdersTable orders={list} />
			</Box>
		</Box>
	);
}
