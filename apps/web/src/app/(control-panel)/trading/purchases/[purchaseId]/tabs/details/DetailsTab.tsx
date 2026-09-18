'use client';

import { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';
import { useUpdatePurchasePaymentMutation } from '../../../../TradingApi';
import { PurchasePaymentStatusChip } from '../../../purchasePaymentStatus';

const PAYMENT_STATUS = { UNPAID: 0, PAID: 1, PARTIAL: 2 } as const;
const PAYMENT_TYPE = { CASH: 1, MOMO: 2, BANK: 3, OTHER: 4 } as const;

/**
 * The purchase details tab.
 */
function DetailsTab({ purchase }: { purchase: any }) {
	const [open, setOpen] = useState(false);
	const [paymentStatus, setPaymentStatus] = useState<number>(PAYMENT_STATUS.PAID);
	const [paymentType, setPaymentType] = useState<number>(PAYMENT_TYPE.CASH);
	const [amountPaid, setAmountPaid] = useState('');
	const [paymentReference, setPaymentReference] = useState('');
	const [paymentNumber, setPaymentNumber] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [updatePayment, { isLoading: saving }] = useUpdatePurchasePaymentMutation();

	const netTotal = useMemo(
		() => Math.max(0, Number(purchase?.total_amount ?? 0) - Number(purchase?.discount_amount ?? 0)),
		[purchase?.total_amount, purchase?.discount_amount]
	);
	const isUnpaidOrPartial = Number(purchase?.payment_status) !== PAYMENT_STATUS.PAID;

	const openDialog = () => {
		const current = Number(purchase?.payment_status);
		const next = current === PAYMENT_STATUS.PARTIAL ? PAYMENT_STATUS.PARTIAL : PAYMENT_STATUS.PAID;
		setPaymentStatus(next);
		setPaymentType(Number(purchase?.payment_type) || PAYMENT_TYPE.CASH);
		setAmountPaid(
			next === PAYMENT_STATUS.PAID
				? String(netTotal.toFixed(2))
				: purchase?.amount_paid != null && Number(purchase.amount_paid) > 0
					? String(Number(purchase.amount_paid).toFixed(2))
					: ''
		);
		setPaymentReference(String(purchase?.payment_reference || ''));
		setPaymentNumber(String(purchase?.payment_number || '').replace(/\D/g, '').slice(0, 50));
		setError(null);
		setOpen(true);
	};

	const savePayment = async () => {
		setError(null);
		let resolvedAmount = Number(String(amountPaid).replace(/,/g, ''));
		if (paymentStatus === PAYMENT_STATUS.PAID) {
			if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) resolvedAmount = netTotal;
		} else if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
			setError('Enter how much was paid for a partial payment.');
			return;
		}

		try {
			await updatePayment({
				id: String(purchase.id),
				body: {
					payment_status: paymentStatus,
					payment_type: paymentType,
					amount_paid: resolvedAmount,
					payment_reference: paymentReference.trim() || null,
					payment_number: paymentNumber.trim() || null,
					payment_date: new Date().toISOString()
				}
			}).unwrap();
			setOpen(false);
		} catch (e: any) {
			setError(e?.data?.message || e?.message || 'Could not save payment.');
		}
	};

	return (
		<div className="w-full max-w-5xl space-y-12">
			<div className="space-y-4">
				<div className="flex items-center border-b-1 space-x-2 pb-2">
					<FuseSvgIcon color="action" size={24}>
						heroicons-outline:user-circle
					</FuseSvgIcon>
					<Typography className="text-2xl" color="text.secondary">
						Supplier
					</Typography>
				</div>

				<div className="space-y-4">
					<div className="table-responsive border rounded-md">
						<table className="table dense simple">
							<thead>
								<tr>
									<th>
										<Typography className="font-semibold">Name</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Contact Person</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Business Location</Typography>
									</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>
										<div className="flex items-center">
											<Avatar src={undefined} />
											<Typography className="truncate mx-2">{purchase.supplier || 'N/A'}</Typography>
										</div>
									</td>
									<td>
										<Typography className="truncate">{purchase.supplier_manager || 'N/A'}</Typography>
									</td>
									<td>
										<Typography className="truncate">{purchase.supplier_address || 'N/A'}</Typography>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<div className="flex items-center justify-between border-b-1 pb-2 gap-3">
					<div className="flex items-center space-x-2">
						<FuseSvgIcon color="action" size={24}>
							heroicons-outline:hashtag
						</FuseSvgIcon>
						<Typography className="text-2xl" color="text.secondary">
							Payment
						</Typography>
					</div>
					{isUnpaidOrPartial ? (
						<Button
							variant="contained"
							color="secondary"
							size="small"
							onClick={openDialog}
							startIcon={<FuseSvgIcon size={16}>heroicons-outline:wallet</FuseSvgIcon>}
							sx={{ textTransform: 'none' }}
						>
							{Number(purchase.payment_status) === PAYMENT_STATUS.PARTIAL ? 'Update payment' : 'Record payment'}
						</Button>
					) : null}
				</div>

				<div className="table-responsive border rounded-md">
					<table className="simple">
						<thead>
							<tr>
								<th>
									<Typography className="font-semibold">Status</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Method</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Amount paid</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Reference</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Date</Typography>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>
									<PurchasePaymentStatusChip status={purchase.payment_status} />
								</td>
								<td>
									<span className="truncate">
										{Number(purchase.payment_type) === 2
											? 'MoMo'
											: Number(purchase.payment_type) === 3
												? 'Bank'
												: Number(purchase.payment_type) === 4
													? 'Other'
													: Number(purchase.payment_type) === 1
														? 'Cash'
														: '—'}
									</span>
								</td>
								<td>
									<span className="truncate">
										{formatGhsCurrency(Number(purchase.amount_paid ?? 0), 2, 2)}
									</span>
								</td>
								<td>
									<span className="truncate">{purchase.payment_reference || '—'}</span>
								</td>
								<td>
									<span className="truncate">
										{purchase.payment_date
											? new Date(purchase.payment_date).toDateString()
											: purchase.due_date
												? `Due ${new Date(purchase.due_date).toDateString()}`
												: '—'}
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
				<DialogTitle>Record payment</DialogTitle>
				<DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
					<Typography variant="body2" color="text.secondary">
						Purchase total: {formatGhsCurrency(netTotal, 2, 2)}
					</Typography>
					{error ? <Alert severity="error">{error}</Alert> : null}

					<div>
						<Typography variant="caption" color="text.secondary" className="mb-1 block">
							Status
						</Typography>
						<ToggleButtonGroup
							exclusive
							size="small"
							value={paymentStatus}
							onChange={(_e, value) => {
								if (value == null) return;
								setPaymentStatus(value);
								if (value === PAYMENT_STATUS.PAID) setAmountPaid(String(netTotal.toFixed(2)));
							}}
						>
							<ToggleButton value={PAYMENT_STATUS.PAID}>Paid</ToggleButton>
							<ToggleButton value={PAYMENT_STATUS.PARTIAL}>Partial</ToggleButton>
						</ToggleButtonGroup>
					</div>

					<div>
						<Typography variant="caption" color="text.secondary" className="mb-1 block">
							Method
						</Typography>
						<ToggleButtonGroup
							exclusive
							size="small"
							value={paymentType}
							onChange={(_e, value) => {
								if (value != null) setPaymentType(value);
							}}
						>
							<ToggleButton value={PAYMENT_TYPE.CASH}>Cash</ToggleButton>
							<ToggleButton value={PAYMENT_TYPE.MOMO}>MoMo</ToggleButton>
							<ToggleButton value={PAYMENT_TYPE.BANK}>Bank</ToggleButton>
							<ToggleButton value={PAYMENT_TYPE.OTHER}>Other</ToggleButton>
						</ToggleButtonGroup>
					</div>

					<TextField
						label="Amount paid"
						size="small"
						value={amountPaid}
						onChange={(e) => {
							const val = e.target.value;
							if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setAmountPaid(val);
						}}
						placeholder={String(netTotal.toFixed(2))}
					/>
					<TextField
						label="Reference (optional)"
						size="small"
						value={paymentReference}
						onChange={(e) => setPaymentReference(e.target.value.slice(0, 50))}
						placeholder="Receipt / transfer ref"
					/>
					{paymentType === PAYMENT_TYPE.MOMO || paymentType === PAYMENT_TYPE.BANK ? (
						<TextField
							label={paymentType === PAYMENT_TYPE.MOMO ? 'MoMo number (optional)' : 'Account number (optional)'}
							size="small"
							type="tel"
							value={paymentNumber}
							onChange={(e) => {
								const digits = e.target.value.replace(/\D/g, '');
								setPaymentNumber(
									paymentType === PAYMENT_TYPE.MOMO ? digits.slice(0, 10) : digits.slice(0, 50)
								);
							}}
							onPaste={(e) => {
								e.preventDefault();
								const digits = String(e.clipboardData.getData('text') || '').replace(/\D/g, '');
								setPaymentNumber(
									paymentType === PAYMENT_TYPE.MOMO ? digits.slice(0, 10) : digits.slice(0, 50)
								);
							}}
							slotProps={{
								htmlInput: {
									inputMode: 'numeric',
									pattern: '[0-9]*',
									autoComplete: 'tel'
								}
							}}
							placeholder={paymentType === PAYMENT_TYPE.MOMO ? '0241234567' : 'Account number'}
						/>
					) : null}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpen(false)} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={savePayment} disabled={saving}>
						Save payment
					</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
}

export default DetailsTab;
