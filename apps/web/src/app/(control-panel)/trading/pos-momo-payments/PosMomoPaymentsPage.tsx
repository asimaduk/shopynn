'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';
import { useAppDispatch } from 'src/store/hooks';
import useUser from '@auth/useUser';
import {
	useGetPendingPosMomoPaymentsQuery,
	useLazyVerifyPaymentQuery,
	useAbandonPosMomoPaymentMutation
} from '../../billing/SubscriptionApi';
import { useCreateSaleMutation } from '../TradingApi';
import { allocateNextInvoiceNumber } from '@/utils/invoiceNumbering';
import { writeResumeParkedMomo } from './resumeParkedMomo';

function toMoney(n: number) {
	return Math.round((Number(n) || 0) * 100) / 100;
}

function formatGhs(n: unknown) {
	return `₵ ${toMoney(Number(n) || 0).toFixed(2)}`;
}

function formatWhen(iso?: string) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function isSuccessStatus(status?: string) {
	const s = String(status || '').toLowerCase();
	return ['success', 'paid', 'completed'].includes(s);
}

function isPendingStatus(status?: string) {
	const s = String(status || '').toLowerCase();
	return ['pending', 'otp', 'ongoing', 'send_otp'].includes(s);
}

function productLines(snapshot: any): Array<Record<string, any>> {
	if (!snapshot) return [];
	if (Array.isArray(snapshot.products)) return snapshot.products;
	if (Array.isArray(snapshot.currentOrder)) return snapshot.currentOrder;
	return [];
}

export default function PosMomoPaymentsPage() {
	const theme = useTheme();
	const router = useRouter();
	const dispatch = useAppDispatch();
	const { data: user } = useUser();
	const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'success' | 'abandoned'>('all');
	const [busyRef, setBusyRef] = useState<string | null>(null);

	const statusQuery = statusTab === 'all' ? undefined : statusTab;
	const { data, isLoading, isFetching, refetch } = useGetPendingPosMomoPaymentsQuery(
		statusQuery ? { status: statusQuery } : undefined
	);
	const [verifyPayment] = useLazyVerifyPaymentQuery();
	const [abandonPayment] = useAbandonPosMomoPaymentMutation();
	const [createSale] = useCreateSaleMutation();

	const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
	const isAbandonedTab = statusTab === 'abandoned';

	const summary = useMemo(() => {
		const pending = rows.filter((r) => isPendingStatus(r?.status)).length;
		const paid = rows.filter((r) => isSuccessStatus(r?.status)).length;
		const faceTotal = rows.reduce((sum, r) => sum + Number(r?.face_amount ?? r?.amount ?? 0), 0);
		return { count: rows.length, pending, paid, faceTotal };
	}, [rows]);

	const handleCheckStatus = async (row: any) => {
		const ref = row?.transaction_ref;
		if (!ref) return;
		setBusyRef(ref);
		try {
			const res: any = await verifyPayment(ref).unwrap();
			const status = String(res?.status || res?.data?.status || '').toLowerCase();
			dispatch(
				showMessage({
					message: isSuccessStatus(status)
						? 'Payment confirmed — you can Complete sale.'
						: `Status: ${status || 'pending'}`
				})
			);
			refetch();
		} catch (err: any) {
			dispatch(showMessage({ message: err?.data?.message || 'Could not verify payment' }));
		} finally {
			setBusyRef(null);
		}
	};

	const handleResume = (row: any) => {
		writeResumeParkedMomo({
			transaction_ref: row.transaction_ref,
			payment_number: row.payment_number,
			status: row.status,
			face_amount: row.face_amount,
			fee_amount: row.fee_amount,
			amount: row.amount,
			pos_cart_snapshot: row.pos_cart_snapshot
		});
		router.push('/trading/newsale');
	};

	const handleComplete = async (row: any) => {
		const ref = row?.transaction_ref;
		const snap = row?.pos_cart_snapshot;
		const lines = productLines(snap);
		if (!ref) return;
		if (!isSuccessStatus(row?.status)) {
			dispatch(showMessage({ message: 'Payment is not confirmed yet. Check status first.' }));
			return;
		}
		if (!lines.length) {
			dispatch(
				showMessage({
					message: 'No cart snapshot — use Resume to rebuild the sale on New Sale.'
				})
			);
			handleResume(row);
			return;
		}

		setBusyRef(ref);
		try {
			const products = lines.map((o) => ({
				id: o.id,
				quantity: Number(o.order_quantity ?? o.quantity) || 1,
				unit_price: Number(o.unit_price) || 0,
				name: o.name || ''
			}));
			const total_amount = toMoney(
				Number(row.face_amount) > 0
					? Number(row.face_amount)
					: products.reduce((s, p) => s + p.quantity * p.unit_price, 0)
			);
			const payload = {
				id: Date.now(),
				total_amount,
				discount_amount: 0,
				invoice_number: allocateNextInvoiceNumber(),
				current_status: 1,
				customer_id: snap?.customer_id || null,
				customer: snap?.customer_name || 'Walk In',
				sale_date: new Date().toJSON(),
				products,
				notes: `Paid with momo ${row.payment_number || ''} ref ${ref}${
					row.fee_amount ? ` (fee ${row.fee_amount})` : ''
				}`,
				cashier: (user as any)?.displayName || '',
				created_at: new Date().toJSON(),
				warehouse_id: snap?.warehouse_id || (user as any)?.warehouse?.id,
				payment_method: 'momo',
				payment_number: row.payment_number || null,
				payment_reference: ref,
				payment_transaction_ref: ref,
				payment_type: 2,
				company: {
					name: (user as any)?.company?.name || (user as any)?.companyName || 'Shopynn',
					organization: (user as any)?.company?.organization || '',
					address: (user as any)?.company?.address || '',
					phone: (user as any)?.company?.phone || ''
				}
			};

			const res = await createSale(payload);
			if ('error' in res && res.error) {
				const err = res.error as any;
				dispatch(
					showMessage({
						message: err?.data?.message || err?.message || 'Could not complete sale'
					})
				);
				return;
			}
			dispatch(showMessage({ message: 'Sale completed.' }));
			refetch();
		} catch (err: any) {
			dispatch(showMessage({ message: err?.message || 'Could not complete sale' }));
		} finally {
			setBusyRef(null);
		}
	};

	const handleAbandon = async (row: any) => {
		const ref = row?.transaction_ref;
		if (!ref || isSuccessStatus(row?.status)) return;
		const ok = window.confirm(
			'Abandon this MoMo prompt? We will check the network first. If the customer already paid, abandon will be blocked.'
		);
		if (!ok) return;
		setBusyRef(ref);
		try {
			await abandonPayment({ reference: ref }).unwrap();
			dispatch(showMessage({ message: 'Payment abandoned.' }));
			refetch();
		} catch (err: any) {
			const msg = err?.data?.message || err?.data?.data?.message || 'Could not abandon payment';
			const code = err?.data?.code || err?.data?.data?.code;
			dispatch(
				showMessage({
					message:
						code === 'PAYMENT_ALREADY_SUCCESS' || /already succeeded/i.test(String(msg))
							? msg
							: msg
				})
			);
			refetch();
		} finally {
			setBusyRef(null);
		}
	};

	if (isLoading) return <FuseLoading />;

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
								bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.22 : 0.14),
								color: 'warning.main'
							}}
						>
							<FuseSvgIcon size={24}>heroicons-outline:device-phone-mobile</FuseSvgIcon>
						</Box>
						<div className="min-w-0">
							<Typography component="h1" className="text-4xl font-extrabold leading-none tracking-tight">
								Pending MoMo
							</Typography>
							<Typography variant="body2" color="text.secondary" className="mt-1">
								Parked POS mobile-money payments waiting for approval or sale completion.
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
						variant="outlined"
						size="medium"
						startIcon={
							isFetching ? (
								<CircularProgress size={16} />
							) : (
								<FuseSvgIcon size={18}>heroicons-outline:arrow-path</FuseSvgIcon>
							)
						}
						onClick={() => refetch()}
						sx={{ textTransform: 'none', fontWeight: 600, px: 2, whiteSpace: 'nowrap' }}
					>
						Refresh
					</Button>
				</motion.div>
			</div>

			<Paper
				elevation={0}
				className="mb-6 overflow-hidden shadow-sm"
				sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}
			>
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, minmax(0, 1fr))' },
						gap: 0,
						divideX: true
					}}
				>
					{[
						{ label: 'Open', value: String(summary.count) },
						{ label: 'Waiting', value: String(summary.pending) },
						{ label: 'Paid (complete)', value: String(summary.paid) },
						{ label: 'Face total', value: formatGhs(summary.faceTotal) }
					].map((item) => (
						<Box key={item.label} sx={{ px: 2.5, py: 2, borderRight: { sm: `1px solid ${theme.palette.divider}` } }}>
							<Typography variant="caption" color="text.secondary">
								{item.label}
							</Typography>
							<Typography variant="h6" fontWeight={700}>
								{item.value}
							</Typography>
						</Box>
					))}
				</Box>
			</Paper>

			<Paper
				elevation={0}
				sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3, overflow: 'hidden' }}
			>
				<Tabs
					value={statusTab}
					onChange={(_, v) => setStatusTab(v)}
					sx={{ px: 1, borderBottom: `1px solid ${theme.palette.divider}` }}
				>
					<Tab value="all" label="Open" sx={{ textTransform: 'none' }} />
					<Tab value="pending" label="Waiting" sx={{ textTransform: 'none' }} />
					<Tab value="success" label="Paid" sx={{ textTransform: 'none' }} />
					<Tab value="abandoned" label="Abandoned" sx={{ textTransform: 'none' }} />
				</Tabs>

				{rows.length === 0 ? (
					<Box sx={{ py: 8, textAlign: 'center' }}>
						<Typography color="text.secondary">
							{isAbandonedTab ? 'No abandoned MoMo payments.' : 'No pending MoMo payments.'}
						</Typography>
						<Typography variant="body2" color="text.secondary" className="mt-1">
							{isAbandonedTab
								? 'Abandoned charges from the last 30 days appear here.'
								: 'From New Sale, after Send, tap Park & serve next to park a payment here.'}
						</Typography>
					</Box>
				) : (
					<Box sx={{ display: 'flex', flexDirection: 'column' }}>
						{rows.map((row: any) => {
							const ref = row.transaction_ref;
							const busy = busyRef === ref;
							const paid = isSuccessStatus(row.status);
							const abandoned = String(row.status || '').toLowerCase() === 'abandoned';
							const lines = productLines(row.pos_cart_snapshot);
							const itemCount = lines.length;
							const creator = [
								row.abandoned_by_first_name || row.creator_first_name,
								row.abandoned_by_last_name || row.creator_last_name
							]
								.filter(Boolean)
								.join(' ');
							return (
								<Box
									key={row.id || ref}
									sx={{
										display: 'flex',
										flexDirection: { xs: 'column', md: 'row' },
										alignItems: { md: 'center' },
										gap: 2,
										px: 2.5,
										py: 2,
										borderBottom: `1px solid ${theme.palette.divider}`
									}}
								>
									<Box className="min-w-0 flex-1">
										<div className="mb-1 flex flex-wrap items-center gap-2">
											<Typography fontWeight={700}>{formatGhs(row.face_amount ?? row.amount)}</Typography>
											<Chip
												size="small"
												label={
													paid ? 'Paid' : abandoned ? 'Abandoned' : String(row.status || 'pending')
												}
												color={paid ? 'success' : abandoned ? 'default' : 'warning'}
												variant="outlined"
											/>
											{itemCount > 0 ? (
												<Chip size="small" label={`${itemCount} item${itemCount === 1 ? '' : 's'}`} />
											) : (
												<Chip size="small" label="No cart" variant="outlined" color="default" />
											)}
										</div>
										<Typography variant="body2" color="text.secondary">
											{row.payment_number || '—'} ·{' '}
											{formatWhen(abandoned ? row.updated_at || row.created_at : row.created_at)}
										</Typography>
										<Typography variant="caption" color="text.secondary" display="block">
											Ref {ref}
											{row.pos_cart_snapshot?.customer_name
												? ` · ${row.pos_cart_snapshot.customer_name}`
												: ''}
											{creator ? ` · by ${creator}` : ''}
										</Typography>
									</Box>
									{!abandoned ? (
										<Box className="flex flex-wrap gap-1">
											{!paid && (
												<Button
													size="small"
													variant="outlined"
													disabled={busy}
													onClick={() => handleCheckStatus(row)}
													sx={{ textTransform: 'none' }}
												>
													Check status
												</Button>
											)}
											{paid && itemCount > 0 && (
												<Button
													size="small"
													variant="contained"
													color="secondary"
													disabled={busy}
													onClick={() => handleComplete(row)}
													sx={{ textTransform: 'none' }}
												>
													Complete sale
												</Button>
											)}
											{!paid && (
												<Button
													size="small"
													variant="text"
													color="inherit"
													disabled={busy}
													onClick={() => handleAbandon(row)}
													sx={{ textTransform: 'none' }}
												>
													Abandon
												</Button>
											)}
										</Box>
									) : (
										<Typography variant="caption" color="text.secondary">
											History — open on mobile for full activity timeline.
										</Typography>
									)}
								</Box>
							);
						})}
					</Box>
				)}
			</Paper>
		</Box>
	);
}
