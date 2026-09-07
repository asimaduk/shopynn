'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import FusePageCarded from '@fuse/core/FusePageCarded';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../parity/FeatureUnavailable';
import {
	useCancelOrderMutation,
	useGetStoreOrderByIdQuery,
	useGetStoreOrderDeliveryQuery,
	useGetStoreOrderHistoryQuery,
	useMarkStoreOrderPaidMutation,
	useRecordStoreOrderPartialCashMutation,
	useUpdateStoreOrderDeliveryMutation,
	useUpdateStoreOrderStatusMutation
} from '../../TradingApi';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';

const TRANSITIONS: Record<string, string[]> = {
	pending: ['confirmed'],
	confirmed: ['processing'],
	processing: ['ready'],
	ready: ['shipped', 'completed'],
	shipped: ['delivered'],
	delivered: ['completed'],
	completed: [],
	cancelled: []
};

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed'] as const;

const formatStatusLabel = (value: any) =>
	String(value || '')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase());

const getStatusChipColor = (value: string) => {
	const status = String(value || '').toLowerCase();
	if (status === 'completed' || status === 'delivered') return { bg: '#dcfce7', text: '#16a34a' };
	if (status === 'cancelled') return { bg: '#fee2e2', text: '#dc2626' };
	if (status === 'processing' || status === 'confirmed' || status === 'shipped') return { bg: '#dbeafe', text: '#2563eb' };
	if (status === 'ready') return { bg: '#ede9fe', text: '#7c3aed' };
	return { bg: '#fef3c7', text: '#d97706' };
};

const formatQty = (value: any) => {
	const n = Number(value);
	if (!Number.isFinite(n)) return String(value ?? '');
	// keep fabric fractional quantities, but remove trailing zeros
	return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

const buildStatusTimeMap = (order: any, history: any[]) => {
	const map = new Map<string, string>();
	if (order?.created_at) {
		map.set('pending', String(order.created_at));
	}
	(history || []).forEach((h: any) => {
		const to = String(h?.to_status || '').toLowerCase();
		const at = h?.created_at ? String(h.created_at) : '';
		if (!to || !at) return;
		if (!map.has(to)) map.set(to, at);
	});
	return map;
};

export default function StoreOrderDetailsPage() {
	const params = useParams<{ id: string }>();
	const orderId = params.id;
	const isMobile = useThemeMediaQuery((_theme) => _theme.breakpoints.down('lg'));
	const { data, isLoading, refetch } = useGetStoreOrderByIdQuery(orderId);
	const { data: deliveryData, refetch: refetchDelivery } = useGetStoreOrderDeliveryQuery(orderId);
	const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useGetStoreOrderHistoryQuery(orderId);
	const history = useMemo(
		() => (Array.isArray(historyData) ? historyData : historyData?.items || historyData?.list || []),
		[historyData]
	);
	const cancelledEntry = useMemo(
		() =>
			[...history]
				.reverse()
				.find((h: any) => String(h?.to_status || '').toLowerCase() === 'cancelled' && String(h?.reason || '').trim()),
		[history]
	);
	const statusTimes = useMemo(() => buildStatusTimeMap(data, history), [data?.id, data?.created_at, history]);

	const [nextStatus, setNextStatus] = useState('');
	const [reason, setReason] = useState('');
	const [cancelReason, setCancelReason] = useState('');
	const [localError, setLocalError] = useState('');
	const [updateStatus, { isLoading: updating }] = useUpdateStoreOrderStatusMutation();
	const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
	const [updateDelivery, { isLoading: deliverySaving }] = useUpdateStoreOrderDeliveryMutation();
	const [markOrderPaid, { isLoading: markingPaid }] = useMarkStoreOrderPaidMutation();
	const [recordPartialCash, { isLoading: recordingPartial }] = useRecordStoreOrderPartialCashMutation();
	const [partialAmount, setPartialAmount] = useState('');
	const [partialNote, setPartialNote] = useState('');
	const currentStatus = String(data?.status || '').toLowerCase();
	const isInstallmentOrder = String(data?.payment_mode || 'full').toLowerCase() === 'installment';
	const balanceDue = Number(data?.balance_due ?? 0);
	const amountPaid = Number(data?.amount_paid ?? 0);
	const installmentPayments = Array.isArray(data?.installment_payments) ? data.installment_payments : [];
	const allowedStatuses = TRANSITIONS[currentStatus] || [];
	const requiresReason = nextStatus === 'completed';
	const canCancelNow = ['pending', 'confirmed'].includes(currentStatus);
	const isDeliveryOrder = String(data?.fulfillment_type || '').toLowerCase() === 'delivery';
	const [courierName, setCourierName] = useState('');
	const [courierPhone, setCourierPhone] = useState('');
	const [trackingNumber, setTrackingNumber] = useState('');
	const [dispatchNote, setDispatchNote] = useState('');
	const [deliveryNote, setDeliveryNote] = useState('');

	const statusPalette = useMemo(() => getStatusChipColor(currentStatus), [currentStatus]);

	const paymentStatusRaw = String(data?.payment_status || 'unpaid').toLowerCase();
	const canMarkCashPaid = useMemo(() => {
		if (isInstallmentOrder && balanceDue > 0) return false;
		if (paymentStatusRaw === 'paid') return false;
		const fulfillment = String(data?.fulfillment_type || 'pickup').toLowerCase();
		if (fulfillment === 'pickup') return currentStatus === 'completed';
		if (fulfillment === 'delivery') return currentStatus === 'delivered' || currentStatus === 'completed';
		return false;
	}, [paymentStatusRaw, data?.fulfillment_type, currentStatus, isInstallmentOrder, balanceDue]);
	const canRecordPartialCash = isInstallmentOrder && balanceDue > 0.02;
	const paymentPalette = useMemo(() => {
		if (paymentStatusRaw === 'paid') return { bg: '#dcfce7', text: '#16a34a' };
		if (paymentStatusRaw === 'failed') return { bg: '#fee2e2', text: '#dc2626' };
		if (paymentStatusRaw === 'pending') return { bg: '#fef3c7', text: '#d97706' };
		return { bg: '#f3f4f6', text: '#6b7280' };
	}, [paymentStatusRaw]);

	useEffect(() => {
		// Keep the select usable by ensuring its value is always one of the allowed transitions.
		// When status changes, prefer the first allowed transition; otherwise keep current selection.
		const first = allowedStatuses[0] || '';
		setNextStatus((prev) => (prev && allowedStatuses.includes(prev) ? prev : first));
		setReason('');
		setLocalError('');
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentStatus, allowedStatuses.join('|')]);

	const syncDeliveryForm = (delivery: any) => {
		setCourierName(delivery?.courier_name || '');
		setCourierPhone(delivery?.courier_phone || '');
		setTrackingNumber(delivery?.tracking_number || '');
		setDispatchNote(delivery?.dispatch_note || '');
		setDeliveryNote(delivery?.delivery_note || '');
	};

	useEffect(() => {
		syncDeliveryForm(deliveryData);
	}, [deliveryData?.id]);

	const onUpdateStatus = async () => {
		setLocalError('');
		setLocalError('');
		if (!nextStatus || !allowedStatuses.includes(nextStatus)) {
			setLocalError('No valid next status is available for this order.');
			return;
		}
		if (requiresReason && !reason.trim()) {
			setLocalError('Reason is required when completing an order.');
			return;
		}
		try {
			await updateStatus({ id: orderId, status: nextStatus, reason }).unwrap();
			await Promise.all([refetch(), refetchHistory(), refetchDelivery()]);
			setReason('');
		} catch (error: any) {
			console.error('Failed to update store order status', error);
			setLocalError(
				error?.data?.error ||
				error?.data?.message ||
				error?.message ||
				'Could not update order status.'
			);
		}
	};

	const onCancelOrder = async () => {
		setLocalError('');
		if (!cancelReason.trim()) {
			setLocalError('Cancellation reason is required.');
			return;
		}
		await cancelOrder({ id: orderId, reason: cancelReason.trim() }).unwrap();
		await Promise.all([refetch(), refetchHistory(), refetchDelivery()]);
		setCancelReason('');
	};

	const onSaveDelivery = async () => {
		await updateDelivery({
			id: orderId,
			body: {
				courier_name: courierName,
				courier_phone: courierPhone,
				tracking_number: trackingNumber,
				dispatch_note: dispatchNote,
				delivery_note: deliveryNote
			}
		}).unwrap();
		await refetchDelivery();
	};

	const onRecordPartialCash = async () => {
		setLocalError('');
		const amt = Number(partialAmount);
		if (!Number.isFinite(amt) || amt <= 0) {
			setLocalError('Enter a valid partial payment amount.');
			return;
		}
		if (amt > balanceDue + 0.02) {
			setLocalError(`Amount cannot exceed remaining balance (${formatGhsCurrency(balanceDue, 2, 2)}).`);
			return;
		}
		try {
			await recordPartialCash({ id: orderId, amount: amt, note: partialNote.trim() || undefined }).unwrap();
			setPartialAmount('');
			setPartialNote('');
			await refetch();
		} catch (error: any) {
			setLocalError(
				error?.data?.error ||
					error?.data?.message ||
					error?.message ||
					'Could not record partial cash payment.'
			);
		}
	};

	const onMarkCashPaid = async () => {
		setLocalError('');
		const ok = window.confirm('Mark this order as paid in cash? This cannot be undone automatically.');
		if (!ok) return;
		try {
			await markOrderPaid({ id: orderId }).unwrap();
			await Promise.all([refetch(), refetchHistory(), refetchDelivery()]);
		} catch (error: any) {
			setLocalError(
				error?.data?.error ||
				error?.data?.message ||
				error?.message ||
				'Could not mark order as paid.'
			);
		}
	};

	return (
		<PermissionGate
			requiredPermissions={['orders.store.view']}
			requiredFeatures={['orders.store.view']}
			fallback={<FeatureUnavailable title="Store Order Details" message="You do not have access to store order details." />}
		>
			<FusePageCarded
				header={
					<div className="flex flex-1 flex-col py-5">
						<PageBreadcrumb className="mb-2" />
						<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
							<div className="min-w-0">
								<Typography className="text-2xl truncate font-semibold">
									{data?.order_number || orderId}
								</Typography>
								<Typography variant="caption" className="font-medium text-secondary">
									{data?.customer_name ? `Customer: ${data.customer_name}` : 'Customer order'}
								</Typography>
							</div>
							<Stack direction="row" spacing={1} alignItems="center" className="shrink-0">
								<Chip
									label={formatStatusLabel(currentStatus || 'pending')}
									size="small"
									sx={{ backgroundColor: statusPalette.bg, color: statusPalette.text, fontWeight: 700 }}
								/>
								<Chip
									label={formatStatusLabel(data?.fulfillment_type || 'pickup')}
									size="small"
									variant="outlined"
									sx={{ fontWeight: 600 }}
								/>
								<Chip
									label={`Payment: ${formatStatusLabel(paymentStatusRaw)}`}
									size="small"
									sx={{ backgroundColor: paymentPalette.bg, color: paymentPalette.text, fontWeight: 700 }}
								/>
							</Stack>
						</div>
					</div>
				}
				content={
					<div className="p-4 sm:p-6 w-full">
						{isLoading ? (
							<FuseLoading />
						) : (
							<div className="w-full max-w-6xl space-y-6">
								<Grid container spacing={2}>
									<Grid item xs={12} md={7}>
										<Card variant="outlined">
											<CardContent>
												<Typography className="text-lg font-semibold">Order summary</Typography>
												<Divider className="my-4" />
												<Grid container spacing={2}>
													<Grid item xs={12} sm={6}>
														<Typography variant="caption" className="text-secondary">Store</Typography>
														<Typography className="font-medium">
															{data?.warehouse_name || data?.warehouse_id || 'N/A'}
														</Typography>
													</Grid>
													<Grid item xs={12} sm={6}>
														<Typography variant="caption" className="text-secondary">Created</Typography>
														<Typography className="font-medium">
															{data?.created_at ? new Date(data.created_at).toLocaleString() : '—'}
														</Typography>
													</Grid>
													<Grid item xs={12} sm={6}>
														<Typography variant="caption" className="text-secondary">Total</Typography>
														<Typography className="text-xl font-semibold tabular-nums">
															{formatGhsCurrency(data?.total_amount || 0, 2, 2)}
														</Typography>
													</Grid>
													{isInstallmentOrder ? (
														<>
															<Grid item xs={12} sm={6}>
																<Typography variant="caption" className="text-secondary">Amount paid</Typography>
																<Typography className="font-medium tabular-nums text-green-700">
																	{formatGhsCurrency(amountPaid, 2, 2)}
																</Typography>
															</Grid>
															<Grid item xs={12} sm={6}>
																<Typography variant="caption" className="text-secondary">Balance due</Typography>
																<Typography
																	className="font-semibold tabular-nums"
																	color={balanceDue > 0 ? 'warning.main' : 'success.main'}
																>
																	{formatGhsCurrency(balanceDue, 2, 2)}
																</Typography>
															</Grid>
														</>
													) : null}
													<Grid item xs={12} sm={6}>
														<Typography variant="caption" className="text-secondary">Fulfillment</Typography>
														<Typography className="font-medium">
															{formatStatusLabel(data?.fulfillment_type || 'pickup')}
														</Typography>
													</Grid>
													<Grid item xs={12}>
														<Typography variant="caption" className="text-secondary">Order note</Typography>
														<Typography className="font-medium">
															{(data?.notes || data?.note || '').trim() || '—'}
														</Typography>
													</Grid>
												</Grid>
											</CardContent>
										</Card>
									</Grid>

									<Grid item xs={12} md={5}>
										<Card variant="outlined">
											<CardContent>
												<Typography className="text-lg font-semibold">Status timeline</Typography>
												<Divider className="my-4" />
												<Stack spacing={1.2}>
													{STATUS_STEPS.map((step, idx) => {
														const stepKey = String(step);
														const active = stepKey === currentStatus;
														const done = currentStatus === 'cancelled'
															? history.some((h: any) => String(h?.to_status || '').toLowerCase() === stepKey)
															: STATUS_STEPS.indexOf(step as any) <= STATUS_STEPS.indexOf(currentStatus as any);
														const hasNext = idx < STATUS_STEPS.length - 1;
														const at = statusTimes.get(stepKey);
														return (
															<Box key={stepKey} className="flex items-start justify-between gap-12">
																<Box className="flex items-start gap-10">
																	<Box sx={{ position: 'relative', width: 26, display: 'flex', justifyContent: 'center' }}>
																		<Box
																			sx={{
																				width: 18,
																				height: 18,
																				borderRadius: 999,
																				display: 'flex',
																				alignItems: 'center',
																				justifyContent: 'center',
																				backgroundColor: done ? 'primary.main' : 'background.paper',
																				border: (theme) =>
																					active
																						? `2px solid ${theme.palette.primary.main}`
																						: `2px solid ${done ? theme.palette.primary.main : theme.palette.divider}`,
																				boxShadow: active ? '0 0 0 4px rgba(59,134,209,0.16)' : 'none'
																			}}
																		>
																			{done ? <CheckRoundedIcon sx={{ fontSize: 14, color: '#fff' }} /> : null}
																		</Box>
																		{hasNext && (
																			<Box
																				sx={{
																					position: 'absolute',
																					top: 18,
																					left: '50%',
																					transform: 'translateX(-50%)',
																					width: 2,
																					height: 20,
																					backgroundColor: done ? 'primary.main' : 'divider'
																				}}
																			/>
																		)}
																	</Box>
																	<Box className="min-w-0">
																		<Typography className={active ? 'font-semibold' : ''} color={active ? 'text.primary' : 'text.secondary'}>
																			{formatStatusLabel(stepKey)}
																		</Typography>
																		{at ? (
																			<Typography variant="caption" className="text-secondary">
																				{new Date(at).toLocaleString()}
																			</Typography>
																		) : (
																			<Typography variant="caption" className="text-secondary">
																				—
																			</Typography>
																		)}
																	</Box>
																</Box>
																{done && (
																	<Tooltip title="Completed step">
																		<Typography variant="caption" className="text-secondary">
																			Done
																		</Typography>
																	</Tooltip>
																)}
															</Box>
														);
													})}
													{currentStatus === 'cancelled' && (
														<Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
															{cancelledEntry?.reason
																? `Cancelled: ${cancelledEntry.reason}`
																: 'This order was cancelled.'}
														</Alert>
													)}
												</Stack>
											</CardContent>
										</Card>
									</Grid>
								</Grid>

								<Card variant="outlined">
									<CardContent>
										<Box className="flex items-center justify-between gap-12 flex-wrap">
											<Typography className="text-lg font-semibold">Items</Typography>
											<Typography variant="caption" className="text-secondary">
												{Array.isArray(data?.items) ? `${data.items.length} item(s)` : ''}
											</Typography>
										</Box>
										<Divider className="my-4" />
										{Array.isArray(data?.items) && data.items.length > 0 ? (
											<Box className="table-responsive border rounded-md">
												<Table className="simple dense">
													<TableHead>
														<TableRow>
															<TableCell>
																<Typography className="font-semibold">Product</Typography>
															</TableCell>
															<TableCell>
																<Typography className="font-semibold">Qty</Typography>
															</TableCell>
															<TableCell>
																<Typography className="font-semibold">Unit price</Typography>
															</TableCell>
															<TableCell align="right">
																<Typography className="font-semibold">Line total</Typography>
															</TableCell>
														</TableRow>
													</TableHead>
													<TableBody>
														{data.items.map((item: any) => (
															<TableRow key={item.id}>
																<TableCell>
																	<Typography className="font-medium">
																		{item.product_name || item.product_id}
																	</Typography>
																	{item.sku && (
																		<Typography variant="caption" className="text-secondary">
																			SKU: {item.sku}
																		</Typography>
																	)}
																</TableCell>
																<TableCell sx={{ fontWeight: 600 }}>
																	{formatQty(item.quantity)}
																</TableCell>
																<TableCell sx={{ fontWeight: 600 }}>
																	{formatGhsCurrency(item.unit_price || 0, 2, 2)}
																</TableCell>
																<TableCell align="right" sx={{ fontWeight: 700 }}>
																	{formatGhsCurrency(item.line_total || 0, 2, 2)}
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</Box>
										) : (
											<Typography className="text-secondary">No items.</Typography>
										)}
									</CardContent>
								</Card>

								{isDeliveryOrder && (
									<PermissionGate requiredPermissions={['orders.delivery.manage']} requiredFeatures={['orders.delivery.manage']}>
										<Card variant="outlined">
											<CardContent>
												<Typography className="text-lg font-semibold">Delivery</Typography>
												<Typography variant="caption" className="text-secondary">
													Manage courier, tracking, and dispatch notes.
												</Typography>
												<Divider className="my-4" />

												<Grid container spacing={2}>
													<Grid item xs={12} md={4}>
														<TextField fullWidth size="small" label="Courier name" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
													</Grid>
													<Grid item xs={12} md={4}>
														<TextField fullWidth size="small" label="Courier phone" value={courierPhone} onChange={(e) => setCourierPhone(e.target.value)} />
													</Grid>
													<Grid item xs={12} md={4}>
														<TextField fullWidth size="small" label="Tracking #" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
													</Grid>
													<Grid item xs={12} md={6}>
														<TextField fullWidth size="small" label="Dispatch note" value={dispatchNote} onChange={(e) => setDispatchNote(e.target.value)} />
													</Grid>
													<Grid item xs={12} md={6}>
														<TextField fullWidth size="small" label="Delivery note" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
													</Grid>
												</Grid>

												<Box className="flex items-center justify-between flex-wrap gap-6 mt-10">
													<Stack spacing={0.5}>
														{deliveryData?.dispatched_at && (
															<Typography variant="caption" className="text-secondary">
																Dispatched: {new Date(deliveryData.dispatched_at).toLocaleString()}
															</Typography>
														)}
														{deliveryData?.delivered_at && (
															<Typography variant="caption" className="text-secondary">
																Delivered: {new Date(deliveryData.delivered_at).toLocaleString()}
															</Typography>
														)}
													</Stack>
													<Button variant="contained" onClick={onSaveDelivery} disabled={deliverySaving}>
														Save delivery
													</Button>
												</Box>
											</CardContent>
										</Card>
									</PermissionGate>
								)}

								<Grid container spacing={2}>
									<Grid item xs={12} md={7}>
										<PermissionGate
											// requiredPermissions={['orders.status.update']}
											requiredPermissions={['orders.process']}
											requiredFeatures={['orders.status.update']}
											fallback={
												<Card variant="outlined">
													<CardContent>
														<Typography className="text-lg font-semibold">Update status</Typography>
														<Typography variant="caption" className="text-secondary">
															Move this order through its workflow.
														</Typography>
														<Divider className="my-4" />
														<Alert severity="info" variant="outlined">
															You don’t have access to update order status. If you believe this is a mistake, check your subscription features and role permissions.
														</Alert>
													</CardContent>
												</Card>
											}
										>
											<Card variant="outlined">
												<CardContent>
													<Typography className="text-lg font-semibold">Update status</Typography>
													<Typography variant="caption" className="text-secondary">
														Move this order through its workflow.
													</Typography>
													<Divider className="my-4" />
													{localError && (
														<Alert severity="warning" className="mb-8">
															{localError}
														</Alert>
													)}
													{allowedStatuses.length === 0 ? (
														<Alert severity="info" variant="outlined">
															No further status updates are available for this order.
														</Alert>
													) : (
														<>
															<Grid container spacing={2}>
																<Grid item xs={12} md={4}>
																	<TextField
																		fullWidth
																		select
																		size="small"
																		label="Next status"
																		value={nextStatus}
																		onChange={(e) => setNextStatus(e.target.value)}
																	>
																		{allowedStatuses.map((status) => (
																			<MenuItem key={status} value={status}>
																				{formatStatusLabel(status)}
																			</MenuItem>
																		))}
																	</TextField>
																</Grid>
																<Grid item xs={12} md={8}>
																	<TextField
																		fullWidth
																		size="small"
																		label={requiresReason ? 'Reason (required)' : 'Reason (optional)'}
																		value={reason}
																		onChange={(e) => setReason(e.target.value)}
																	/>
																</Grid>
															</Grid>
															<Box className="flex items-center justify-end mt-12">
																<Button variant="contained" onClick={onUpdateStatus} disabled={updating || allowedStatuses.length === 0}>
																	Update
																</Button>
															</Box>
														</>
													)}
												</CardContent>
											</Card>
										</PermissionGate>
									</Grid>

									<Grid item xs={12} md={5}>
										<PermissionGate
											requiredPermissions={['orders.update']}
											requiredFeatures={['orders.status.update']}
										>
											{canRecordPartialCash ? (
												<Card variant="outlined" className="mb-16">
													<CardContent>
														<Typography className="text-lg font-semibold">Pay over time — record cash</Typography>
														<Typography variant="caption" className="text-secondary">
															Record a partial cash payment. Fulfillment stays blocked until balance is zero.
														</Typography>
														<Divider className="my-4" />
														{installmentPayments.length > 0 ? (
															<Table size="small" className="mb-12">
																<TableHead>
																	<TableRow>
																		<TableCell>Date</TableCell>
																		<TableCell>Amount</TableCell>
																		<TableCell>Method</TableCell>
																		<TableCell>Status</TableCell>
																	</TableRow>
																</TableHead>
																<TableBody>
																	{installmentPayments.map((p: any) => (
																		<TableRow key={p.id}>
																			<TableCell>
																				{p.created_at
																					? new Date(p.created_at).toLocaleString()
																					: '—'}
																			</TableCell>
																			<TableCell>{formatGhsCurrency(p.amount || 0, 2, 2)}</TableCell>
																			<TableCell>{formatStatusLabel(p.payment_method)}</TableCell>
																			<TableCell>{formatStatusLabel(p.status)}</TableCell>
																		</TableRow>
																	))}
																</TableBody>
															</Table>
														) : null}
														<TextField
															fullWidth
															size="small"
															label="Amount (GHS)"
															type="number"
															value={partialAmount}
															onChange={(e) => setPartialAmount(e.target.value)}
															inputProps={{ min: 0, step: 0.01, max: balanceDue }}
															className="mb-8"
														/>
														<TextField
															fullWidth
															size="small"
															label="Note (optional)"
															value={partialNote}
															onChange={(e) => setPartialNote(e.target.value)}
															className="mb-8"
														/>
														<Box className="flex items-center justify-end">
															<Button
																variant="contained"
																onClick={onRecordPartialCash}
																disabled={recordingPartial}
															>
																Record payment
															</Button>
														</Box>
													</CardContent>
												</Card>
											) : null}
											{canMarkCashPaid ? (
												<Card variant="outlined" className="mb-16">
													<CardContent>
														<Typography className="text-lg font-semibold">Cash payment</Typography>
														<Typography variant="caption" className="text-secondary">
															Mark this order as paid after cash is collected on pickup or delivery.
														</Typography>
														<Divider className="my-4" />
														<Box className="flex items-center justify-end">
															<Button variant="contained" color="success" onClick={onMarkCashPaid} disabled={markingPaid}>
																Mark paid (cash)
															</Button>
														</Box>
													</CardContent>
												</Card>
											) : null}
										</PermissionGate>

										<PermissionGate requiredPermissions={['orders.cancel']} requiredFeatures={['orders.cancel']}>
											{canCancelNow ? (
												<Card variant="outlined">
													<CardContent>
														<Typography className="text-lg font-semibold">Cancel order</Typography>
														<Typography variant="caption" className="text-secondary">
															Cancellation is only available in pending/confirmed.
														</Typography>
														<Divider className="my-4" />
														{localError && (
															<Alert severity="warning" className="mb-8">
																{localError}
															</Alert>
														)}
														<TextField
															fullWidth
															size="small"
															label="Cancellation reason (required)"
															value={cancelReason}
															onChange={(e) => setCancelReason(e.target.value)}
														/>
														<Box className="flex items-center justify-end mt-12">
															<Button color="error" variant="outlined" onClick={onCancelOrder} disabled={cancelling}>
																Cancel order
															</Button>
														</Box>
													</CardContent>
												</Card>
											) : null}
										</PermissionGate>
									</Grid>
								</Grid>

								<Card variant="outlined">
									<CardContent>
										<Typography className="text-lg font-semibold">History</Typography>
										<Typography variant="caption" className="text-secondary">
											All status changes recorded for this order.
										</Typography>
										<Divider className="my-4" />
										{historyLoading ? (
											<Typography className="text-secondary">Loading history...</Typography>
										) : history.length > 0 ? (
											<Stack spacing={1.5}>
												{history.map((h: any) => (
													<Box key={h.id} className="flex items-start justify-between gap-8 flex-wrap">
														<Box className="min-w-0">
															<Typography className="font-medium">
																{formatStatusLabel(h.from_status || 'new')} → {formatStatusLabel(h.to_status || '')}
															</Typography>
															<Typography variant="caption" className="text-secondary">
																{h.reason || 'Status change'}
															</Typography>
														</Box>
														{h.created_at && (
															<Typography variant="caption" className="text-secondary">
																{new Date(h.created_at).toLocaleString()}
															</Typography>
														)}
													</Box>
												))}
											</Stack>
										) : (
											<Typography className="text-secondary">No history records.</Typography>
										)}
									</CardContent>
								</Card>
							</div>
						)}
					</div>
				}
				scroll={isMobile ? 'normal' : 'content'}
			/>
		</PermissionGate>
	);
}
