import { useEffect, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';
import { useAppDispatch } from 'src/store/hooks';
import { MOMO_NETWORK_OPTIONS } from '@/utils/momoNetworks';
import { useRecordSalePaymentMutation } from '../../../../TradingApi';
import {
	useAbandonPosMomoPaymentMutation,
	useInitiatePaymentMutation,
	useLazyVerifyPaymentQuery,
	useSubmitPaymentOtpMutation
} from '../../../../../billing/SubscriptionApi';
import { formatGhsCurrency } from '../../../../../dashboards/analytics/daily-sales/formatGhsCurrency';

type MomoState = {
	ref: string | null;
	face: number;
	charge: number;
	paid: boolean;
	needsOtp: boolean;
	status: string;
};

const EMPTY_MOMO: MomoState = { ref: null, face: 0, charge: 0, paid: false, needsOtp: false, status: '' };

const GH_MOMO_PREFIXES: Record<string, string[]> = {
	mtn: ['24', '25', '53', '54', '55', '59'],
	telecel: ['20', '50'],
	airteltigo: ['26', '27', '56', '57']
};

function normalizeGhanaMomoNumber(raw: unknown) {
	let digits = String(raw || '').replace(/\D/g, '');
	if (digits.startsWith('233') && digits.length >= 12) digits = `0${digits.slice(3)}`;
	else if (digits.length === 9) digits = `0${digits}`;
	return digits.slice(0, 10);
}

function inferProvider(phone: string) {
	const local = normalizeGhanaMomoNumber(phone).replace(/^0/, '');
	if (local.length !== 9) return null;
	const networkId = Object.keys(GH_MOMO_PREFIXES).find((k) => GH_MOMO_PREFIXES[k].includes(local.slice(0, 2)));
	return MOMO_NETWORK_OPTIONS.find((n) => n.id === networkId)?.provider || null;
}

function needsOtp(status: unknown, displayText: unknown) {
	const st = String(status || '').toLowerCase();
	if (st === 'send_otp' || st === 'otp' || st === 'send_pin' || st === 'pay_offline') return true;
	return /\botp\b|\bvoucher\b|\*110#/.test(String(displayText || '').toLowerCase());
}

function errorMessage(err: any, fallback: string) {
	return err?.data?.message || err?.data?.error || err?.message || fallback;
}

const newRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type Props = {
	open: boolean;
	onClose: () => void;
	onRecorded: () => void;
	saleId: string;
	balanceDue: number;
	storeCreditBalance: number;
	customerId?: string | null;
	customerPhone?: string | null;
};

function CollectPaymentDialog({
	open,
	onClose,
	onRecorded,
	saleId,
	balanceDue,
	storeCreditBalance,
	customerId,
	customerPhone
}: Props) {
	const dispatch = useAppDispatch();
	const [recordPayment, { isLoading: saving }] = useRecordSalePaymentMutation();
	const [initiatePayment] = useInitiatePaymentMutation();
	const [submitOtp] = useSubmitPaymentOtpMutation();
	const [verifyPayment] = useLazyVerifyPaymentQuery();
	const [abandonPosPayment] = useAbandonPosMomoPaymentMutation();

	const [amount, setAmount] = useState('');
	const [method, setMethod] = useState('cash');
	const [note, setNote] = useState('');
	const [phone, setPhone] = useState('');
	const [provider, setProvider] = useState<string>('mtn');
	const [momo, setMomo] = useState<MomoState>(EMPTY_MOMO);
	const [otp, setOtp] = useState('');
	const [busy, setBusy] = useState(false);
	const savingRef = useRef(false);
	const checkingRef = useRef(false);
	const requestIdRef = useRef<string | null>(null);

	const canUseStoreCredit = Boolean(customerId) && storeCreditBalance > 0.001;
	const momoLocked = Boolean(momo.ref);
	const notify = (message: string) => dispatch(showMessage({ message }));

	useEffect(() => {
		if (!open) return;
		const p = normalizeGhanaMomoNumber(customerPhone);
		setAmount(balanceDue > 0 ? balanceDue.toFixed(2) : '');
		setMethod('cash');
		setNote('');
		setPhone(p);
		setProvider(inferProvider(p) || 'mtn');
		setMomo(EMPTY_MOMO);
		setOtp('');
		requestIdRef.current = newRequestId();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const validateAmount = (forMethod: string): number | null => {
		const amt = Number(String(amount).replace(/,/g, ''));
		if (!Number.isFinite(amt) || amt < 0.01) {
			notify('Enter a valid collection amount');
			return null;
		}
		if (amt > balanceDue + 0.02) {
			notify(`Amount cannot exceed balance due (${formatGhsCurrency(balanceDue, 2, 2)})`);
			return null;
		}
		if (forMethod === 'store_credit') {
			if (!customerId) {
				notify('Store credit requires a customer on this sale');
				return null;
			}
			if (amt > storeCreditBalance + 0.02) {
				notify(`Available store credit is ${formatGhsCurrency(storeCreditBalance, 2, 2)}`);
				return null;
			}
		}
		return Math.round(amt * 100) / 100;
	};

	const save = async (confirmed?: { ref: string; face: number }) => {
		if (savingRef.current) return;
		const payMethod = confirmed ? 'momo' : method;
		let amt: number | null;
		let ref: string | null = null;
		if (payMethod === 'momo') {
			ref = confirmed?.ref || (momo.paid ? momo.ref : null);
			if (!ref) {
				notify('Send the MoMo prompt and wait for the customer to approve it');
				return;
			}
			amt = confirmed?.face || momo.face;
		} else {
			amt = validateAmount(payMethod);
			if (amt == null) return;
		}
		savingRef.current = true;
		try {
			const body: Record<string, unknown> = {
				amount: amt,
				payment_method: payMethod,
				note: note.trim() || null,
				client_request_id: requestIdRef.current
			};
			if (payMethod === 'momo') {
				body.payment_transaction_ref = ref;
				body.payment_reference = ref;
				body.payment_number = normalizeGhanaMomoNumber(phone) || null;
			}
			await recordPayment({ saleId, body }).unwrap();
			setMomo(EMPTY_MOMO);
			onRecorded();
			notify(`${formatGhsCurrency(amt, 2, 2)} recorded`);
		} catch (err: any) {
			notify(errorMessage(err, 'Could not record payment'));
		} finally {
			savingRef.current = false;
		}
	};

	const markPaid = (ref: string, face: number) => {
		setMomo((m) => ({ ...m, ref, face, paid: true, needsOtp: false, status: 'MoMo payment confirmed.' }));
		void save({ ref, face });
	};

	const sendPrompt = async (forceNew = false) => {
		const amt = validateAmount('momo');
		if (amt == null) return;
		const digits = normalizeGhanaMomoNumber(phone);
		if (!/^0\d{9}$/.test(digits)) {
			notify('Enter a full 10-digit MoMo number');
			return;
		}
		setBusy(true);
		setOtp('');
		setMomo({ ...EMPTY_MOMO, status: forceNew ? 'Starting a new MoMo prompt…' : 'Sending MoMo prompt…' });
		try {
			const res: any = await initiatePayment({
				face_amount: amt,
				payment_method: 'mobile_money',
				phone: digits,
				provider,
				source: 'pos_sale',
				payment_number: digits,
				force_new: forceNew
			}).unwrap();
			const ref = res?.transaction_ref;
			if (!ref) {
				setMomo(EMPTY_MOMO);
				notify('No payment reference returned');
				return;
			}
			const face = Number(res?.face_amount) || amt;
			const charge = Number(res?.charge_amount) || face;
			if (res?.reused || String(res?.status || '').toLowerCase() === 'success') {
				setMomo({ ...EMPTY_MOMO, ref, face, charge });
				markPaid(ref, face);
				return;
			}
			const telecel = provider === 'vod';
			setMomo({
				ref,
				face,
				charge,
				paid: false,
				needsOtp: telecel || needsOtp(res?.status, res?.display_text),
				status:
					res?.display_text ||
					(telecel
						? 'Ask the customer to dial *110#, then enter the voucher below.'
						: 'Ask the customer to approve the MoMo prompt on their phone.')
			});
		} catch (err: any) {
			setMomo(EMPTY_MOMO);
			notify(errorMessage(err, 'Could not start MoMo payment'));
		} finally {
			setBusy(false);
		}
	};

	const checkStatus = async (silent = false) => {
		const { ref, face } = momo;
		if (!ref || momo.paid || checkingRef.current) return;
		checkingRef.current = true;
		if (!silent) setBusy(true);
		try {
			const v: any = await verifyPayment(ref).unwrap();
			const st = String(v?.status || v?.data?.status || '').toLowerCase();
			if (st === 'success' || st === 'paid' || st === 'completed') {
				markPaid(ref, face);
			} else if (st === 'failed' || st === 'abandoned' || st === 'reversed') {
				setMomo({ ...EMPTY_MOMO, status: v?.display_text || 'MoMo payment failed. Send a new prompt.' });
			} else if (needsOtp(st, v?.display_text)) {
				setMomo((m) => ({ ...m, needsOtp: true, status: v?.display_text || 'Enter the OTP / voucher from the network.' }));
			} else if (!silent) {
				setMomo((m) => ({ ...m, status: v?.display_text || 'Still waiting for the customer to approve.' }));
			}
		} catch (err: any) {
			if (!silent) notify(errorMessage(err, 'Could not check status'));
		} finally {
			checkingRef.current = false;
			if (!silent) setBusy(false);
		}
	};

	const checkStatusRef = useRef(checkStatus);
	checkStatusRef.current = checkStatus;

	useEffect(() => {
		if (!open || method !== 'momo' || !momo.ref || momo.paid || momo.needsOtp) return undefined;
		const timer = setInterval(() => checkStatusRef.current(true), 5000);
		const stop = setTimeout(() => clearInterval(timer), 3 * 60 * 1000);
		return () => {
			clearInterval(timer);
			clearTimeout(stop);
		};
	}, [open, method, momo.ref, momo.paid, momo.needsOtp]);

	const handleOtp = async () => {
		const code = otp.trim();
		if (!momo.ref || !code) {
			notify(provider === 'vod' ? 'Enter the voucher from *110#' : 'Enter the OTP from the network');
			return;
		}
		setBusy(true);
		try {
			const res: any = await submitOtp({ reference: momo.ref, otp: code }).unwrap();
			const st = String(res?.status || res?.data?.status || '').toLowerCase();
			if (st === 'success') {
				markPaid(momo.ref, momo.face);
			} else {
				setOtp('');
				setMomo((m) => ({
					...m,
					needsOtp: provider === 'vod' || needsOtp(st, res?.display_text),
					status: res?.display_text || 'Submitted. Waiting for confirmation…'
				}));
			}
		} catch (err: any) {
			notify(errorMessage(err, 'Could not submit the code'));
		} finally {
			setBusy(false);
		}
	};

	const resendPrompt = async () => {
		const ok = window.confirm(
			'Send a new prompt? This cancels the open one. Only do this if the customer did not get it or it timed out.'
		);
		if (!ok) return;
		if (momo.ref) {
			try {
				await abandonPosPayment({ reference: momo.ref }).unwrap();
			} catch (err: any) {
				if (/already succeeded/i.test(errorMessage(err, '')) || err?.data?.code === 'PAYMENT_ALREADY_SUCCESS') {
					markPaid(momo.ref, momo.face);
					return;
				}
			}
		}
		void sendPrompt(true);
	};

	const selectMethod = (next: string) => {
		if (next === method) return;
		if (momo.paid && momo.ref) {
			notify('Record the confirmed MoMo payment before switching method');
			return;
		}
		if (momo.ref) {
			abandonPosPayment({ reference: momo.ref }).catch(() => {});
		}
		setMomo(EMPTY_MOMO);
		setOtp('');
		setMethod(next);
		if (next === 'store_credit') {
			setAmount(Math.min(balanceDue, storeCreditBalance).toFixed(2));
		}
	};

	const handleClose = () => {
		if (saving || busy) return;
		if (momo.paid && momo.ref) {
			const close = window.confirm(
				`${formatGhsCurrency(momo.face, 2, 2)} was received by MoMo but is not yet recorded on this sale. Close anyway?`
			);
			if (!close) return;
		}
		onClose();
	};

	return (
		<Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
			<DialogTitle>Collect payment</DialogTitle>
			<DialogContent className="flex flex-col gap-3 pt-2">
				<Typography variant="body2" color="text.secondary">
					Balance due {formatGhsCurrency(balanceDue, 2, 2)}
				</Typography>
				{canUseStoreCredit ? (
					<Typography variant="body2" color="text.secondary">
						Store credit available {formatGhsCurrency(storeCreditBalance, 2, 2)}
					</Typography>
				) : null}
				<TextField
					label="Amount"
					type="number"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					disabled={momoLocked}
					fullWidth
					InputLabelProps={{ shrink: true }}
				/>
				<TextField
					select
					label="Method"
					value={method}
					onChange={(e) => selectMethod(e.target.value)}
					fullWidth
				>
					<MenuItem value="cash">Cash</MenuItem>
					<MenuItem value="momo">MoMo</MenuItem>
					{canUseStoreCredit ? <MenuItem value="store_credit">Store credit</MenuItem> : null}
				</TextField>
				{method === 'momo' ? (
					<>
						<div className="flex gap-2">
							<TextField
								label="Customer MoMo number"
								value={phone}
								onChange={(e) => {
									setPhone(e.target.value);
									const inferred = inferProvider(e.target.value);
									if (inferred) setProvider(inferred);
								}}
								disabled={momoLocked}
								className="flex-1"
							/>
							<TextField
								select
								label="Network"
								value={provider}
								onChange={(e) => setProvider(e.target.value)}
								disabled={momoLocked}
								className="w-36"
							>
								{MOMO_NETWORK_OPTIONS.map((n) => (
									<MenuItem key={n.id} value={n.provider}>
										{n.label}
									</MenuItem>
								))}
							</TextField>
						</div>
						{momo.status ? (
							<Typography variant="body2" color={momo.paid ? 'success.main' : 'text.secondary'}>
								{momo.status}
							</Typography>
						) : null}
						{momo.ref && momo.charge > momo.face + 0.001 ? (
							<Typography variant="caption" color="text.secondary">
								Customer approves {formatGhsCurrency(momo.charge, 2, 2)} (includes{' '}
								{formatGhsCurrency(momo.charge - momo.face, 2, 2)} fee).
							</Typography>
						) : null}
						{momo.ref && !momo.paid && momo.needsOtp ? (
							<div className="flex gap-2">
								<TextField
									label={provider === 'vod' ? 'Voucher from *110#' : 'OTP'}
									value={otp}
									onChange={(e) => setOtp(e.target.value)}
									className="flex-1"
								/>
								<Button variant="contained" onClick={handleOtp} disabled={busy}>
									Submit
								</Button>
							</div>
						) : null}
						{momo.ref && !momo.paid ? (
							<div className="flex gap-2">
								<Button variant="outlined" onClick={() => checkStatus()} disabled={busy} className="flex-1">
									Check status
								</Button>
								<Button onClick={resendPrompt} disabled={busy} className="flex-1">
									Send again
								</Button>
							</div>
						) : null}
					</>
				) : null}
				<TextField
					label="Note (optional)"
					value={note}
					onChange={(e) => setNote(e.target.value)}
					fullWidth
				/>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose} disabled={saving || busy}>
					Cancel
				</Button>
				{method === 'momo' && !momo.paid ? (
					<Button variant="contained" onClick={() => sendPrompt()} disabled={busy || momoLocked}>
						{busy && !momoLocked ? 'Sending…' : 'Send MoMo prompt'}
					</Button>
				) : (
					<Button variant="contained" onClick={() => save()} disabled={saving}>
						{saving ? 'Saving…' : 'Record'}
					</Button>
				)}
			</DialogActions>
		</Dialog>
	);
}

export default CollectPaymentDialog;
