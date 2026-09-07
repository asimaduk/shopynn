'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FuseLoading from '@fuse/core/FuseLoading';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../parity/FeatureUnavailable';
import { useEffect, useMemo, useState } from 'react';
import { useGetStoreOrdersQuery } from '../TradingApi';
import { useGetWarehousesQuery } from '../../setups/warehouses/WarehouseApi';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission, hasPermissionCodes } from '@auth/permissions';

// Keep workflow order consistent with StoreOrderDetailsPage transitions.
const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed', 'cancelled'];

const formatStatusLabel = (value: string) =>
	String(value || '')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());

export default function StoreOrdersPage() {
	const { data: user } = useUser();
	const [status, setStatus] = useState('');
	const [warehouseId, setWarehouseId] = useState('');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const today = new Date().toISOString().slice(0, 10);
	const canMultiStore =
		hasPermissionCodes(user, 'stores.multi_access') &&
		hasFeatureAndPermission(user, 'stores.multi_access', undefined, 'stores.multi_access');
	const userWarehouseId = user?.warehouse?.id || '';
	const effectiveWarehouseId = canMultiStore ? warehouseId : userWarehouseId;
	const { data: warehousesData } = useGetWarehousesQuery(undefined, { skip: !canMultiStore });
	const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

	useEffect(() => {
		if (!canMultiStore && userWarehouseId) {
			setWarehouseId(userWarehouseId);
		}
	}, [canMultiStore, userWarehouseId]);

	const handleStartDateChange = (nextStart: string) => {
		const safeStart = nextStart && nextStart > today ? today : nextStart;
		setStartDate(safeStart);
		if (endDate && safeStart && safeStart > endDate) {
			setEndDate(safeStart);
		}
	};

	const handleEndDateChange = (nextEnd: string) => {
		if (startDate && nextEnd && nextEnd < startDate) {
			setEndDate(startDate);
			return;
		}
		setEndDate(nextEnd);
	};

	const { data, isLoading, refetch, isFetching } = useGetStoreOrdersQuery({
		status: status || undefined,
		warehouse_id: effectiveWarehouseId || undefined,
		startDate: startDate || undefined,
		endDate: endDate || undefined
	});
	const list = useMemo(() => (Array.isArray(data) ? data : data?.items || data?.list || []), [data]);

	return (
		<PermissionGate
			requiredPermissions={['orders.store.view']}
			requiredFeatures={['orders.store.view']}
			fallback={<FeatureUnavailable title="Store Orders" message="You do not have access to store processing queue." />}
		>
			<Box className="p-24">
				<Box className="flex items-center justify-between gap-12 flex-wrap">
					<Typography variant="h5" className="font-semibold">
						Store Orders
					</Typography>
					<Box className="flex items-center gap-8">
						{canMultiStore && (
							<TextField
								select
								size="small"
								label="Store"
								value={warehouseId}
								onChange={(e) => setWarehouseId(e.target.value)}
								sx={{ minWidth: 220 }}
							>
								<MenuItem value="">All stores</MenuItem>
								{warehouses.map((w: any) => (
									<MenuItem key={w.id} value={w.id}>
										{w.name}
									</MenuItem>
								))}
							</TextField>
						)}
						<TextField
							select
							size="small"
							label="Status"
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							sx={{ minWidth: 180 }}
						>
							{STATUS_OPTIONS.map((s) => (
								<MenuItem key={s || 'all'} value={s}>
									{s ? formatStatusLabel(s) : 'All'}
								</MenuItem>
							))}
						</TextField>
						<TextField
							size="small"
							type="date"
							label="Start date"
							value={startDate}
							onChange={(e) => handleStartDateChange(e.target.value)}
							InputLabelProps={{ shrink: true }}
							inputProps={{ max: today }}
						/>
						<TextField
							size="small"
							type="date"
							label="End date"
							value={endDate}
							onChange={(e) => handleEndDateChange(e.target.value)}
							InputLabelProps={{ shrink: true }}
							inputProps={{ min: startDate || undefined, max: today }}
						/>
						<Button variant="outlined" onClick={() => refetch()} disabled={isFetching}>
							Refresh
						</Button>
					</Box>
				</Box>

				{isLoading ? (
					<FuseLoading />
				) : (
					<Box className="mt-16 space-y-8">
						{list.map((order: any) => (
							<Box key={order.id} className="border rounded-lg p-12 flex items-center justify-between gap-8">
								<Box>
									<Typography className="font-semibold">{order.order_number || order.id}</Typography>
									<Typography className="text-secondary text-sm mt-4">
										{order.warehouse_name || order.warehouse_id} | {formatStatusLabel(String(order.status || ''))}
									</Typography>
								</Box>
								<Button component={Link} href={`/trading/store-orders/${order.id}`}>
									Process
								</Button>
							</Box>
						))}
						{list.length === 0 && <Typography className="text-secondary">No store orders found.</Typography>}
					</Box>
				)}
			</Box>
		</PermissionGate>
	);
}
