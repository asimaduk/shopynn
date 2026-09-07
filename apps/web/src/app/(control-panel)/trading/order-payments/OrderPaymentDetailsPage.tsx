'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogContent, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetPaymentReceiptQuery, useReversePaymentMutation } from '../../billing/SubscriptionApi';

const formatMoney = (amount: any) => `GHS ${Number(amount || 0).toFixed(2)}`;
const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

const formatMethod = (method?: string) => {
	const value = String(method || '').toLowerCase();
	if (value.includes('mobile')) return 'Mobile money';
	if (value.includes('cash')) return 'Cash';
	if (value.includes('card')) return 'Card';
	return '—';
};

const statusPalette = (status?: string) => {
	const s = String(status || '').toLowerCase();
	if (['success', 'paid', 'completed'].includes(s)) return { bg: '#dcfce7', fg: '#16a34a' };
	if (s === 'pending') return { bg: '#fef3c7', fg: '#d97706' };
	if (['failed', 'error', 'voided'].includes(s)) return { bg: '#fee2e2', fg: '#dc2626' };
	return { bg: '#f3f4f6', fg: '#6b7280' };
};

const prettifyEventType = (raw?: string) =>
	String(raw || '')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());

const ReceiptRow = ({ label, value }: { label: string; value: string }) => (
	<Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
		<Typography variant="body2" color="text.secondary">{label}</Typography>
		<Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-word' }}>
			{value || '—'}
		</Typography>
	</Box>
);

export default function OrderPaymentDetailsPage() {
	const theme = useTheme();
	const params = useParams<{ id: string }>();
	const paymentId = String(params?.id || '');
	const { data, isLoading, refetch } = useGetPaymentReceiptQuery(paymentId, { skip: !paymentId });
	const [reason, setReason] = useState('');
	const [error, setError] = useState('');
	const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
	const [reversePayment, { isLoading: reversing }] = useReversePaymentMutation();

	const events = useMemo(() => (Array.isArray(data?.events) ? data.events : []), [data]);
	const canReverse = useMemo(() => {
		const method = String(data?.payment_method_type || '').toLowerCase();
		const status = String(data?.status || '').toLowerCase();
		return method === 'cash' && ['success', 'paid', 'completed'].includes(status);
	}, [data?.payment_method_type, data?.status]);

	const onReverse = async () => {
		setError('');
		const trimmedReason = reason.trim();
		if (!trimmedReason) {
			setError('Reason is required before reversing this payment.');
			return;
		}
		const ok = window.confirm('Are you sure you want to reverse this cash payment?');
		if (!ok) return;
		try {
			await reversePayment({ id: paymentId, reason: trimmedReason }).unwrap();
			setReason('');
			await refetch();
		} catch (e: any) {
			setError(e?.data?.error || e?.data?.message || e?.message || 'Could not reverse payment.');
		}
	};

	const onPrintReceipt = () => {
		const receiptHtml = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payment Receipt</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .receipt-wrap { max-width: 760px; margin: 0 auto; }
    .receipt { background: #ffffff; border: 1px dashed #94a3b8; border-radius: 14px; padding: 18px; }
    .center { text-align: center; }
    .title { font-weight: 800; letter-spacing: 0.5px; margin: 0; }
    .muted { color: #64748b; font-size: 12px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
    .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin: 6px 0; }
    .label { color: #334155; }
    .value { font-weight: 600; text-align: right; word-break: break-word; }
    .foot { text-align: center; color: #64748b; font-size: 12px; margin-top: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
    .panel-title { font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
    @media print { body { background: #fff; padding: 0; } }
  </style>
</head>
<body>
  <div class="receipt-wrap">
    <div class="receipt">
      <div class="center">
        <p class="title">CHEQSTOCK RECEIPT</p>
        <p class="muted">${data?.warehouse_name || 'Store'}</p>
      </div>
      <hr class="divider" />
      <div class="grid">
        <div class="panel">
          <div class="panel-title">Payment Details</div>
          <div class="row"><span class="label">Reference</span><span class="value">${data?.transaction_ref || '—'}</span></div>
          <div class="row"><span class="label">Amount</span><span class="value">${formatMoney(data?.amount)}</span></div>
          <div class="row"><span class="label">Method</span><span class="value">${formatMethod(data?.payment_method_type)}</span></div>
          <div class="row"><span class="label">Paid At</span><span class="value">${formatDateTime(data?.created_at)}</span></div>
        </div>
        <div class="panel">
          <div class="panel-title">Order & Customer</div>
          <div class="row"><span class="label">Order</span><span class="value">${data?.order_number || data?.order_id || '—'}</span></div>
          <div class="row"><span class="label">Ordered At</span><span class="value">${formatDateTime(data?.ordered_at)}</span></div>
          <div class="row"><span class="label">Customer</span><span class="value">${[data?.customer_first_name, data?.customer_last_name].filter(Boolean).join(' ') || data?.customer_email || '—'}</span></div>
          <div class="row"><span class="label">Recorded By</span><span class="value">${[data?.creator_first_name, data?.creator_last_name].filter(Boolean).join(' ') || 'System'}</span></div>
        </div>
      </div>
      <hr class="divider" />
      <p class="foot">Thank you for your payment</p>
    </div>
  </div>
</body>
</html>`;
		const printWindow = window.open('about:blank', '_blank', 'width=520,height=760');
		if (!printWindow) {
			setError('Unable to open print window. Please allow pop-ups and try again.');
			return;
		}
		printWindow.document.open();
		printWindow.document.write(receiptHtml);
		printWindow.document.close();
		window.setTimeout(() => {
			printWindow.focus();
			printWindow.print();
			window.setTimeout(() => {
				printWindow.close();
			}, 250);
		}, 300);
	};

	if (isLoading) return <FuseLoading />;
	const palette = statusPalette(data?.status);
	const summaryItems = [
		{ label: 'Amount', value: formatMoney(data?.amount), icon: 'heroicons-outline:banknotes' },
		{ label: 'Method', value: formatMethod(data?.payment_method_type), icon: 'heroicons-outline:credit-card' },
		{ label: 'Order', value: data?.order_number || data?.order_id || '—', icon: 'heroicons-outline:receipt-percent' },
		{ label: 'Created', value: formatDateTime(data?.created_at), icon: 'heroicons-outline:calendar-days' }
	];

	return (
		<Box className="w-full p-16">
			<PageBreadcrumb className="mb-8" />
			<Paper
				variant="outlined"
				sx={{
					borderRadius: 3,
					mb: 2.5,
					p: 2.5,
					background: `linear-gradient(110deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 65%)`
				}}
			>
				<Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
					<Box>
						<Typography className="text-3xl font-extrabold tracking-tight">Payment Details</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
							Receipt, metadata, and full event timeline for this order payment.
						</Typography>
					</Box>
					<Stack direction="row" spacing={1.2} alignItems="center">
						<Chip
							size="small"
							label={String(data?.status || 'unknown').toUpperCase()}
							sx={{ fontWeight: 800, bgcolor: palette.bg, color: palette.fg }}
						/>
						<Button
							variant="outlined"
							size="small"
							startIcon={<FuseSvgIcon size={16}>heroicons-outline:printer</FuseSvgIcon>}
							onClick={() => setPrintPreviewOpen(true)}
							sx={{ textTransform: 'none', fontWeight: 700 }}
							className="print:hidden"
						>
							Print
						</Button>
						<Link href="/trading/order-payments" className="text-blue-600 hover:underline font-semibold">
							Back to order payments
						</Link>
					</Stack>
				</Stack>
			</Paper>

			<Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, mb: 2 }}>
				{summaryItems.map((item) => (
					<Paper key={item.label} variant="outlined" sx={{ borderRadius: 2.5, p: 1.75 }}>
						<Stack direction="row" spacing={1.2} alignItems="center">
							<Box
								sx={{
									width: 32,
									height: 32,
									borderRadius: 1.5,
									display: 'grid',
									placeItems: 'center',
									bgcolor: alpha(theme.palette.primary.main, 0.12),
									color: 'primary.main'
								}}
							>
								<FuseSvgIcon size={18}>{item.icon}</FuseSvgIcon>
							</Box>
							<Box sx={{ minWidth: 0 }}>
								<Typography variant="caption" color="text.secondary">{item.label}</Typography>
								<Typography className="font-semibold truncate">{item.value}</Typography>
							</Box>
						</Stack>
					</Paper>
				))}
			</Box>

			<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.1fr 1.4fr' } }}>
				<Card variant="outlined" sx={{ borderRadius: 2.5 }}>
					<CardContent>
						<Typography className="text-lg font-semibold">Receipt Information</Typography>
						<Divider sx={{ my: 1.5 }} />
						<Stack spacing={1.2}>
							<Typography><strong>Reference:</strong> {data?.transaction_ref || '—'}</Typography>
							<Typography><strong>Payment ID:</strong> {data?.id || '—'}</Typography>
							<Typography><strong>Store:</strong> {data?.warehouse_name || '—'}</Typography>
							<Typography><strong>Customer:</strong> {[data?.customer_first_name, data?.customer_last_name].filter(Boolean).join(' ') || data?.customer_email || '—'}</Typography>
							<Typography><strong>Recorded By:</strong> {[data?.creator_first_name, data?.creator_last_name].filter(Boolean).join(' ') || 'System'}</Typography>
						</Stack>
					</CardContent>
				</Card>

				<Card variant="outlined" sx={{ borderRadius: 2.5 }}>
					<CardContent>
						<Typography className="text-lg font-semibold">Payment History</Typography>
						<Divider sx={{ my: 1.5 }} />
						{events.length === 0 ? (
							<Typography color="text.secondary">No payment events yet.</Typography>
						) : (
							<Stack spacing={1.2}>
								{events.map((event: any, idx: number) => (
									<Box key={event.id} className="flex gap-12">
										<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.3 }}>
											<Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: 'primary.main' }} />
											{idx < events.length - 1 ? <Box sx={{ width: 2, flex: 1, minHeight: 20, bgcolor: 'divider', mt: 0.5 }} /> : null}
										</Box>
										<Box sx={{ flex: 1, pb: 1 }}>
											<Typography className="font-semibold">{prettifyEventType(event.event_type)}</Typography>
											<Typography variant="caption" color="text.secondary">
												{event.note || 'Event logged'}
											</Typography>
											<Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
												{formatDateTime(event.created_at)}
											</Typography>
										</Box>
									</Box>
								))}
							</Stack>
						)}
					</CardContent>
				</Card>
			</Box>

			{canReverse ? (
				<Card variant="outlined" sx={{ borderRadius: 2.5, mt: 2 }} className="print:hidden">
					<CardContent>
						<Typography className="text-lg font-semibold">Reverse Cash Payment</Typography>
						<Typography variant="caption" color="text.secondary">
							Use this only when cash was marked paid in error.
						</Typography>
						<Divider sx={{ my: 1.5 }} />
						{error ? <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert> : null}
						<Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
							<TextField
								fullWidth
								size="small"
								label="Reason (required)"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
							/>
							<Button color="error" variant="contained" disabled={reversing} onClick={onReverse} sx={{ minWidth: 170 }}>
								{reversing ? 'Reversing...' : 'Reverse Payment'}
							</Button>
						</Stack>
					</CardContent>
				</Card>
			) : null}

			<Dialog open={printPreviewOpen} onClose={() => setPrintPreviewOpen(false)} fullWidth maxWidth="md" className="print:hidden">
				<DialogContent sx={{ p: 0 }}>
					<Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
						<Stack direction="row" alignItems="center" justifyContent="space-between">
							<Typography variant="h6" sx={{ fontWeight: 800 }}>
								Receipt Preview
							</Typography>
							{/* <Chip
								size="small"
								label={String(data?.status || 'unknown').toUpperCase()}
								sx={{ fontWeight: 700, bgcolor: palette.bg, color: palette.fg }}
							/> */}
						</Stack>
					</Box>
					<Box sx={{ p: 2.5, backgroundColor: alpha(theme.palette.background.default, 0.5) }}>
						<Paper
							variant="outlined"
							sx={{
								maxWidth: 760,
								mx: 'auto',
								borderRadius: 2.5,
								p: 2.2,
								borderStyle: 'dashed',
								borderColor: alpha(theme.palette.divider, 0.9)
							}}
						>
							<Stack spacing={1}>
								<Typography sx={{ textAlign: 'center', fontWeight: 800, letterSpacing: 0.5 }}>CHEQSTOCK RECEIPT</Typography>
								<Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
									{data?.warehouse_name || 'Store'}
								</Typography>
							</Stack>
							<Divider sx={{ my: 1.5 }} />
							<Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
								<Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5 }}>
									<Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.2 }}>
										PAYMENT DETAILS
									</Typography>
									<Stack spacing={0.6} sx={{ mt: 0.7 }}>
										<ReceiptRow label="Reference" value={data?.transaction_ref || '—'} />
										<ReceiptRow label="Amount" value={formatMoney(data?.amount)} />
										<ReceiptRow label="Method" value={formatMethod(data?.payment_method_type)} />
										<ReceiptRow label="Paid At" value={formatDateTime(data?.created_at)} />
									</Stack>
								</Paper>
								<Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5 }}>
									<Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.2 }}>
										ORDER & CUSTOMER
									</Typography>
									<Stack spacing={0.6} sx={{ mt: 0.7 }}>
										<ReceiptRow label="Order" value={data?.order_number || data?.order_id || '—'} />
										<ReceiptRow label="Ordered At" value={formatDateTime(data?.ordered_at)} />
										<ReceiptRow label="Customer" value={[data?.customer_first_name, data?.customer_last_name].filter(Boolean).join(' ') || data?.customer_email || '—'} />
										<ReceiptRow label="Recorded By" value={[data?.creator_first_name, data?.creator_last_name].filter(Boolean).join(' ') || 'System'} />
									</Stack>
								</Paper>
							</Box>
							<Divider sx={{ my: 1.5 }} />
							<Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
								Thank you for your payment
							</Typography>
						</Paper>
					</Box>
					<Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
						<Stack direction="row" spacing={1.2} justifyContent="flex-end">
							<Button variant="text" onClick={() => setPrintPreviewOpen(false)} sx={{ textTransform: 'none', fontWeight: 700 }}>
								Close
							</Button>
							<Button
								variant="contained"
								startIcon={<FuseSvgIcon size={16}>heroicons-outline:printer</FuseSvgIcon>}
								onClick={onPrintReceipt}
								sx={{ textTransform: 'none', fontWeight: 700 }}
							>
								Print Receipt
							</Button>
						</Stack>
					</Box>
				</DialogContent>
			</Dialog>

			<Box
				sx={{
					display: 'none',
					'@media print': {
						display: 'block',
						mt: 2
					}
				}}
			>
				<Divider sx={{ my: 1.5 }} />
				<Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
					Order Payment Receipt
				</Typography>
				<Typography variant="body2"><strong>Order:</strong> {data?.order_number || data?.order_id || '—'}</Typography>
				<Typography variant="body2"><strong>Amount:</strong> {formatMoney(data?.amount)}</Typography>
				<Typography variant="body2"><strong>Status:</strong> {String(data?.status || 'unknown').toUpperCase()}</Typography>
				<Typography variant="body2"><strong>Method:</strong> {formatMethod(data?.payment_method_type)}</Typography>
				<Typography variant="body2"><strong>Reference:</strong> {data?.transaction_ref || '—'}</Typography>
				<Typography variant="body2"><strong>Store:</strong> {data?.warehouse_name || '—'}</Typography>
				<Typography variant="body2"><strong>Customer:</strong> {[data?.customer_first_name, data?.customer_last_name].filter(Boolean).join(' ') || data?.customer_email || '—'}</Typography>
				<Typography variant="body2"><strong>Printed At:</strong> {new Date().toLocaleString()}</Typography>
				<Divider sx={{ my: 1.5 }} />
				<Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>Payment Event History</Typography>
				{events.length === 0 ? (
					<Typography variant="body2">No payment events recorded.</Typography>
				) : (
					<Stack spacing={0.8}>
						{events.map((event: any) => (
							<Typography key={event.id} variant="body2">
								{formatDateTime(event.created_at)} - {prettifyEventType(event.event_type)}{event.note ? `: ${event.note}` : ''}
							</Typography>
						))}
					</Stack>
				)}
			</Box>
		</Box>
	);
}
