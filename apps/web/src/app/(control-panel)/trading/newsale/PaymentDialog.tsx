'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import {
	Alert,
	Autocomplete,
	Box,
	CircularProgress,
	MenuItem,
	TextField,
	Typography
} from '@mui/material';
import { useThemeMediaQuery } from '@fuse/hooks';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';
import { useAppDispatch } from 'src/store/hooks';
import {
	useInitiatePaymentMutation,
	useLazyVerifyPaymentQuery,
	useLazyGetOpenPosMomoPaymentQuery,
	useAbandonPosMomoPaymentMutation,
	useParkPosMomoPaymentMutation,
	useSubmitPaymentOtpMutation,
	useGetMomoPaymentChargeQuery
} from '../../billing/SubscriptionApi';
import { MOMO_NETWORK_OPTIONS } from '@/utils/momoNetworks';
import { normalizeWarehousePrinterType } from '../../setups/warehouses/models/WarehouseModel';

function toMoney(n: number) {
	return Math.round((Number(n) || 0) * 100) / 100;
}

function formatGhs(n: number) {
	return `₵ ${toMoney(n).toFixed(2)}`;
}

export type PosCartSnapshot = {
	warehouse_id?: string | null;
	warehouse_name?: string | null;
	customer_id?: string | null;
	customer_name?: string | null;
	products: Array<Record<string, unknown>>;
	bulk_discount?: unknown;
	provider?: string | null;
};

type PaymentDialogProps = {
	open: boolean;
	handleClose: (data: false | Record<string, unknown>) => void;
	saleTotal?: number;
	/** Required for partial / on-credit cash tenders */
	customerId?: string | null;
	/** Available store credit balance for the selected customer */
	availableStoreCredit?: number;
	/** Warehouse printer preference — drives Complete & print vs Complete sale */
	printerType?: string | null;
	/** Cart to persist when parking MoMo and serving the next customer */
	getCartSnapshot?: () => PosCartSnapshot | null;
	/** Prefill when resuming a parked MoMo payment */
	resumeMomo?: {
		transactionRef: string;
		phone?: string;
		provider?: string;
		chargePaid?: boolean;
		statusText?: string;
	} | null;
};

export default function PaymentDialog({
	open,
	handleClose,
	saleTotal = 0,
	customerId = null,
	availableStoreCredit = 0,
	printerType,
	getCartSnapshot,
	resumeMomo
}: PaymentDialogProps) {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const resolvedPrinter = normalizeWarehousePrinterType(printerType);
	const willAutoPrint = resolvedPrinter === 'thermal' || resolvedPrinter === 'a4';
	const completeLabel = willAutoPrint ? 'Complete & print' : 'Complete sale';
	const [paymentType, setPaymentType] = React.useState('');
	const [amountTendered, setAmountTendered] = React.useState('');
	const [storeCreditInput, setStoreCreditInput] = React.useState('');
	const [transNumber, setTransNumber] = React.useState('');
	const [network, setNetwork] = React.useState('mtn');
	const [voucher, setVoucher] = React.useState('');
	const [otp, setOtp] = React.useState('');
	const [otpStep, setOtpStep] = React.useState(false);
	const [transactionRef, setTransactionRef] = React.useState<string | null>(null);
	const [chargePaid, setChargePaid] = React.useState(false);
	const [statusText, setStatusText] = React.useState('');
	const [sending, setSending] = React.useState(false);
	const [parking, setParking] = React.useState(false);
	const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
	const resumeAppliedRef = React.useRef(false);

	const dispatch = useAppDispatch();
	const { data: chargeSettings } = useGetMomoPaymentChargeQuery();
	const [initiatePayment] = useInitiatePaymentMutation();
	const [submitOtp] = useSubmitPaymentOtpMutation();
	const [verifyPayment] = useLazyVerifyPaymentQuery();
	const [fetchOpenPosPayment] = useLazyGetOpenPosMomoPaymentQuery();
	const [abandonPosPayment] = useAbandonPosMomoPaymentMutation();
	const [parkPosPayment] = useParkPosMomoPaymentMutation();

	const saleFace = toMoney(saleTotal);
	const creditAvailable = toMoney(availableStoreCredit);
	const storeCreditApplied = (() => {
		if (!customerId || creditAvailable <= 0.001) return 0;
		const raw = storeCreditInput.trim();
		if (raw === '') return 0;
		const n = Number(String(raw).replace(/,/g, ''));
		if (!Number.isFinite(n) || n <= 0) return 0;
		return toMoney(Math.min(n, creditAvailable, saleFace));
	})();
	const face = toMoney(Math.max(0, saleFace - storeCreditApplied));
	const percent = chargeSettings?.enabled ? Number(chargeSettings.percent) || 0 : 0;
	const fee = chargeSettings?.enabled ? toMoney((face * percent) / 100) : 0;
	const chargeAmount = toMoney(face + fee);
	const isTelecel = network === 'vod';

	const tenderedParsed =
		amountTendered.trim() === '' ? null : Number(String(amountTendered).replace(/,/g, ''));
	const tenderedAmount =
		tenderedParsed != null && Number.isFinite(tenderedParsed) ? toMoney(tenderedParsed) : null;
	const changeAmount =
		tenderedAmount != null ? toMoney(Math.max(0, tenderedAmount - face)) : toMoney(0);
	const hasCustomerForCredit = Boolean(customerId);
	const cashIsPartialOrCredit = tenderedAmount != null && tenderedAmount + 0.001 < face;
	const cashTenderOk =
		tenderedAmount == null ||
		tenderedAmount + 0.001 >= face ||
		(tenderedAmount >= 0 && hasCustomerForCredit);
	const cashAmountPaid =
		tenderedAmount == null ? face : toMoney(Math.min(Math.max(0, tenderedAmount), face));

	const stopPolling = React.useCallback(() => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}, []);

	const requestClose = (data: false | Record<string, unknown>) => {
		if (data === false && chargePaid && transactionRef) {
			const ok = window.confirm(
				'MoMo payment is already confirmed. Closing without completing leaves an unlinked payment.\n\nPrefer “Complete & print”, or “Park & serve next”. Close anyway?'
			);
			if (!ok) return;
		}
		stopPolling();
		handleClose(data);
	};

	React.useEffect(() => {
		if (!open) {
			setPaymentType('');
			setAmountTendered('');
			setStoreCreditInput('');
			setTransNumber('');
			setNetwork('mtn');
			setVoucher('');
			setOtp('');
			setOtpStep(false);
			setTransactionRef(null);
			setChargePaid(false);
			setStatusText('');
			setSending(false);
			setParking(false);
			resumeAppliedRef.current = false;
			stopPolling();
		}
	}, [open, stopPolling]);

	React.useEffect(() => {
		return () => stopPolling();
	}, [stopPolling]);

	/** Resume a parked MoMo payment (from Pending MoMo page). */
	React.useEffect(() => {
		if (!open || !resumeMomo?.transactionRef || resumeAppliedRef.current) return;
		resumeAppliedRef.current = true;
		setPaymentType('Momo');
		setTransactionRef(resumeMomo.transactionRef);
		if (resumeMomo.phone) setTransNumber(String(resumeMomo.phone).replace(/\D/g, ''));
		if (resumeMomo.provider) setNetwork(resumeMomo.provider);
		if (resumeMomo.chargePaid) {
			setChargePaid(true);
			setStatusText(resumeMomo.statusText || 'Payment confirmed. Complete the sale.');
		} else {
			setChargePaid(false);
			setStatusText(
				resumeMomo.statusText ||
					'Waiting for MoMo approval. Tap Check status when the customer confirms.'
			);
			setOtpStep(true);
		}
	}, [open, resumeMomo]);

	const markPaid = React.useCallback(
		(ref: string, message = 'Payment confirmed.') => {
			stopPolling();
			setChargePaid(true);
			setTransactionRef(ref);
			setStatusText(message);
			dispatch(showMessage({ message: 'MoMo payment confirmed' }));
		},
		[dispatch, stopPolling]
	);

	const startPolling = React.useCallback(
		(ref: string) => {
			stopPolling();
			let attempts = 0;
			pollRef.current = setInterval(async () => {
				attempts += 1;
				if (attempts > 40) {
					stopPolling();
					setStatusText('Still waiting for approval. You can keep this open or tap Check status.');
					return;
				}
				try {
					const res: any = await verifyPayment(ref).unwrap();
					const status = String(res?.status || res?.data?.status || '').toLowerCase();
					if (status === 'success' || status === 'paid' || status === 'completed') {
						markPaid(ref);
					}
				} catch {
					/* keep polling */
				}
			}, 3000);
		},
		[markPaid, stopPolling, verifyPayment]
	);

	const applyInitiateResult = async (res: any) => {
		const ref = res?.transaction_ref || res?.data?.transaction_ref;
		if (!ref) {
			dispatch(showMessage({ message: 'No payment reference returned' }));
			return;
		}
		setTransactionRef(ref);

		if (res?.reused || String(res?.status || '').toLowerCase() === 'success') {
			markPaid(
				ref,
				res?.display_text || 'Previous MoMo payment already confirmed. Complete the sale.'
			);
			return;
		}

		if (res?.resume) {
			setStatusText(
				res?.display_text ||
					'A MoMo prompt is already open. Ask the customer to approve it, or tap Check status.'
			);
			setOtpStep(true);
			startPolling(ref);
			return;
		}

		if (isTelecel && voucher.trim()) {
			setStatusText('Submitting Telecel voucher…');
			try {
				const otpRes: any = await submitOtp({
					reference: ref,
					otp: voucher.trim()
				}).unwrap();
				const otpStatus = String(otpRes?.status || otpRes?.data?.status || '').toLowerCase();
				if (otpStatus === 'success') {
					markPaid(ref);
					return;
				}
				setStatusText(otpRes?.display_text || 'Voucher submitted — waiting for confirmation…');
				startPolling(ref);
				return;
			} catch (otpErr: any) {
				dispatch(
					showMessage({
						message: otpErr?.data?.message || 'Voucher failed — you can retry below'
					})
				);
				setOtp(voucher.trim());
				setOtpStep(true);
				startPolling(ref);
				return;
			}
		}

		setStatusText(res?.display_text || 'Approve the MoMo prompt on the phone.');
		const status = String(res?.status || '').toLowerCase();
		if (status === 'success') {
			markPaid(ref);
		} else {
			setOtpStep(true);
			startPolling(ref);
		}
	};

	const handleSend = async (opts?: { forceNew?: boolean }) => {
		if (!transNumber || transNumber.length < 10) {
			dispatch(showMessage({ message: 'Enter a full MoMo number (10 digits)' }));
			return;
		}
		if (isTelecel && !voucher.trim() && !opts?.forceNew) {
			dispatch(showMessage({ message: 'Enter the Telecel voucher (dial *110# to generate)' }));
			return;
		}
		if (face <= 0) {
			dispatch(
				showMessage({
					message:
						storeCreditApplied > 0.001
							? 'Store credit covers this sale — complete without MoMo'
							: 'Sale total must be greater than zero'
				})
			);
			return;
		}
		if (chargePaid && transactionRef) {
			dispatch(
				showMessage({
					message: 'MoMo already confirmed. Use Complete & print — do not send another charge.'
				})
			);
			return;
		}
		setSending(true);
		setStatusText(opts?.forceNew ? 'Starting a new MoMo prompt…' : 'Sending MoMo prompt…');
		try {
			const res: any = await initiatePayment({
				face_amount: face,
				payment_method: 'mobile_money',
				phone: transNumber,
				provider: network,
				source: 'pos_sale',
				payment_number: transNumber,
				force_new: Boolean(opts?.forceNew)
			}).unwrap();
			await applyInitiateResult(res);
		} catch (err: any) {
			dispatch(
				showMessage({
					message: err?.data?.message || err?.message || 'Could not start MoMo payment'
				})
			);
			setStatusText('');
		} finally {
			setSending(false);
		}
	};

	const handleCancelAndSendAgain = async () => {
		if (chargePaid && transactionRef) {
			dispatch(
				showMessage({
					message:
						'Payment already succeeded. Complete the sale — a new Send would risk a double charge.'
				})
			);
			return;
		}
		if (!transactionRef) {
			void handleSend({ forceNew: true });
			return;
		}
		const ok = window.confirm(
			'Start a new MoMo prompt? The customer may still approve the previous one. Only continue if that prompt failed or timed out.'
		);
		if (!ok) return;
		setSending(true);
		try {
			await abandonPosPayment({ reference: transactionRef }).unwrap();
		} catch (err: any) {
			const msg = String(err?.data?.message || err?.message || '');
			if (/already succeeded/i.test(msg) || err?.data?.code === 'PAYMENT_ALREADY_SUCCESS') {
				markPaid(transactionRef, 'MoMo already confirmed. Complete the sale.');
				setSending(false);
				return;
			}
		}
		stopPolling();
		setTransactionRef(null);
		setOtpStep(false);
		setOtp('');
		setStatusText('');
		setSending(false);
		await handleSend({ forceNew: true });
	};

	const handleOtp = async () => {
		if (!transactionRef || !otp) {
			dispatch(showMessage({ message: 'Enter the OTP from the network' }));
			return;
		}
		setSending(true);
		try {
			const res: any = await submitOtp({ reference: transactionRef, otp }).unwrap();
			const status = String(res?.status || res?.data?.status || '').toLowerCase();
			if (status === 'success') {
				markPaid(transactionRef);
			} else {
				setStatusText(res?.display_text || 'OTP submitted — waiting for confirmation…');
				startPolling(transactionRef);
			}
		} catch (err: any) {
			dispatch(showMessage({ message: err?.data?.message || 'OTP failed' }));
		} finally {
			setSending(false);
		}
	};

	const handleCheckStatus = async () => {
		if (!transactionRef) return;
		setSending(true);
		try {
			const res: any = await verifyPayment(transactionRef).unwrap();
			const status = String(res?.status || res?.data?.status || '').toLowerCase();
			if (status === 'success' || status === 'paid' || status === 'completed') {
				markPaid(transactionRef);
			} else {
				setStatusText(`Status: ${status || 'pending'}`);
			}
		} catch (err: any) {
			dispatch(showMessage({ message: err?.data?.message || 'Could not verify payment' }));
		} finally {
			setSending(false);
		}
	};

	const handleSave = () => {
		if (paymentType === 'Momo') {
			if (face > 0.02 && (!chargePaid || !transactionRef)) {
				dispatch(showMessage({ message: 'Confirm MoMo payment with Send before saving' }));
				return;
			}
			requestClose({
				paymentType: face > 0.02 ? 'momo' : 'cash',
				transNumber: face > 0.02 ? transNumber : '',
				payment_transaction_ref: face > 0.02 ? transactionRef : null,
				payment_method: face > 0.02 ? 'momo' : 'cash',
				payment_number: face > 0.02 ? transNumber : null,
				fee_amount: face > 0.02 ? fee : 0,
				charge_amount: face > 0.02 ? chargeAmount : 0,
				amount_paid: face > 0.02 ? face : 0,
				store_credit_applied: storeCreditApplied,
				payment_status:
					toMoney(Math.max(0, saleFace - (face > 0.02 ? face : 0) - storeCreditApplied)) <= 0.02
						? 1
						: 0
			});
			return;
		}
		if (!paymentType) return;
		if (tenderedAmount != null && !cashTenderOk) {
			dispatch(
				showMessage({
					message: cashIsPartialOrCredit && !hasCustomerForCredit
						? 'Select a customer to sell on credit or accept a partial payment'
						: `Amount tendered must be at least the amount due (${formatGhs(face)}), or select a customer for partial/credit`
				})
			);
			return;
		}
		if (cashIsPartialOrCredit && !hasCustomerForCredit) {
			dispatch(
				showMessage({
					message: 'Select a customer to sell on credit or accept a partial payment'
				})
			);
			return;
		}
		const resolvedTendered = tenderedAmount != null ? tenderedAmount : face;
		const amountPaid = cashAmountPaid;
		const balanceDue = toMoney(Math.max(0, saleFace - amountPaid - storeCreditApplied));
		requestClose({
			paymentType: 'cash',
			transNumber: '',
			payment_method: 'cash',
			amount_tendered: resolvedTendered,
			change_amount: toMoney(Math.max(0, resolvedTendered - face)),
			amount_paid: amountPaid,
			store_credit_applied: storeCreditApplied,
			payment_status: balanceDue <= 0.02 ? 1 : amountPaid + storeCreditApplied <= 0.001 ? 0 : 2
		});
	};

	const handleParkAndServeNext = async () => {
		if (!transactionRef) {
			dispatch(showMessage({ message: 'Send MoMo first before parking' }));
			return;
		}
		const snapshot = getCartSnapshot?.();
		if (!snapshot?.products?.length) {
			dispatch(showMessage({ message: 'Cart is empty — nothing to park' }));
			return;
		}
		setParking(true);
		try {
			await parkPosPayment({
				reference: transactionRef,
				cart_snapshot: {
					...snapshot,
					provider: network,
					payment_number: transNumber
				}
			}).unwrap();
			stopPolling();
			handleClose({
				parked: true,
				payment_transaction_ref: transactionRef,
				chargePaid,
				transNumber
			});
		} catch (err: any) {
			dispatch(
				showMessage({
					message: err?.data?.message || err?.message || 'Could not park payment'
				})
			);
		} finally {
			setParking(false);
		}
	};

	React.useEffect(() => {
		if (!open || paymentType !== 'Momo' || face <= 0 || transNumber.length < 10 || chargePaid) {
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const openPay: any = await fetchOpenPosPayment({
					face_amount: face,
					phone: transNumber
				}).unwrap();
				if (cancelled || !openPay?.transaction_ref) return;
				if (openPay.reuse_mode === 'success') {
					markPaid(
						openPay.transaction_ref,
						'Found a confirmed MoMo payment for this amount. Complete the sale.'
					);
				} else if (openPay.reuse_mode === 'pending' && !transactionRef) {
					setTransactionRef(openPay.transaction_ref);
					setOtpStep(true);
					setStatusText('Open MoMo payment found — waiting for customer approval.');
					startPolling(openPay.transaction_ref);
				}
			} catch {
				/* ignore lookup errors */
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, paymentType, face, transNumber]);

	return (
		<Dialog
			open={open}
			onClose={() => requestClose(false)}
			aria-labelledby="alert-dialog-title"
			aria-describedby="alert-dialog-description"
			fullWidth
			maxWidth="xs"
		>
			<DialogTitle id="alert-dialog-title">Make Payment</DialogTitle>
			<DialogContent>
				<DialogContentText>Specify the mode of payment for this transaction</DialogContentText>

				<Autocomplete
					className="my-4 w-full"
					fullWidth
					options={['Cash', 'Momo']}
					value={paymentType as string}
					onChange={(_event, newValue) => {
						if (chargePaid && transactionRef) {
							dispatch(
								showMessage({
									message: 'MoMo already confirmed for this sale. Complete it first.'
								})
							);
							return;
						}
						setPaymentType(newValue || '');
						setAmountTendered('');
						setChargePaid(false);
						setTransactionRef(null);
						setOtpStep(false);
						stopPolling();
					}}
					renderInput={(params) => (
						<TextField
							{...params}
							placeholder="Select payment mode"
							label="Payment"
							variant="outlined"
							InputLabelProps={{ shrink: true }}
						/>
					)}
				/>

				{creditAvailable > 0.001 ? (
					<Box className="mb-3 rounded border border-gray-200 p-3 dark:border-gray-700">
						<Box className="mb-2 flex justify-between text-sm">
							<span>Store credit available</span>
							<strong>{formatGhs(creditAvailable)}</strong>
						</Box>
						<TextField
							fullWidth
							label="Apply store credit"
							placeholder="0.00"
							type="number"
							inputProps={{ min: 0, step: '0.01' }}
							value={storeCreditInput}
							onChange={(e) => setStoreCreditInput(e.target.value)}
							helperText={
								storeCreditApplied > 0.001
									? `Applying ${formatGhs(storeCreditApplied)} · due ${formatGhs(face)}`
									: 'Optional. Reduces cash/MoMo due.'
							}
							InputLabelProps={{ shrink: true }}
							sx={{ mb: 1 }}
						/>
						<Button
							size="small"
							variant="outlined"
							onClick={() =>
								setStoreCreditInput(Math.min(creditAvailable, saleFace).toFixed(2))
							}
						>
							Use max
						</Button>
					</Box>
				) : null}

				{paymentType === 'Cash' && (
					<Box className="mb-2">
						<Box className="mb-3 rounded border border-gray-200 p-3 dark:border-gray-700">
							<Box className="flex justify-between text-sm">
								<span>Sale total</span>
								<strong>{formatGhs(saleFace)}</strong>
							</Box>
							{storeCreditApplied > 0.001 ? (
								<Box className="mt-1 flex justify-between text-sm text-gray-600">
									<span>After store credit</span>
									<strong>{formatGhs(face)}</strong>
								</Box>
							) : null}
							<Box className="mt-1 flex justify-between text-sm text-gray-600">
								<span>Change</span>
								<strong>{formatGhs(changeAmount)}</strong>
							</Box>
						</Box>
						<TextField
							fullWidth
							label="Amount tendered"
							placeholder={face.toFixed(2)}
							type="number"
							inputProps={{ min: 0, step: '0.01' }}
							value={amountTendered}
							onChange={(e) => setAmountTendered(e.target.value)}
							helperText={
								!cashTenderOk
									? cashIsPartialOrCredit && !hasCustomerForCredit
										? 'Select a customer for partial or on-credit sales'
										: `Must be at least ${formatGhs(face)}, or select a customer for credit`
									: cashIsPartialOrCredit && hasCustomerForCredit
										? cashAmountPaid <= 0.001
											? `On credit — balance ${formatGhs(face)}`
											: `Partial — paid ${formatGhs(cashAmountPaid)}, balance ${formatGhs(face - cashAmountPaid)}`
										: amountTendered.trim() === ''
											? 'Leave blank for exact amount. Enter less (with customer) for partial/credit.'
											: `Change due: ${formatGhs(changeAmount)}`
							}
							error={!cashTenderOk}
							InputLabelProps={{ shrink: true }}
							sx={{ mb: 1 }}
						/>
						<Box className="mb-2 flex gap-2">
							<Button
								size="small"
								variant="outlined"
								onClick={() => setAmountTendered(face.toFixed(2))}
							>
								Exact
							</Button>
							<Button
								size="small"
								variant="outlined"
								disabled={!hasCustomerForCredit}
								onClick={() => setAmountTendered('0')}
							>
								On credit
							</Button>
						</Box>
					</Box>
				)}

				{paymentType === 'Momo' && (
					<Box>
						<Box className="mb-3 rounded border border-gray-200 p-3 dark:border-gray-700">
							<Box className="flex justify-between text-sm">
								<span>Sale total</span>
								<strong>{formatGhs(face)}</strong>
							</Box>
							{fee > 0 && (
								<Box className="mt-1 flex justify-between text-sm text-gray-600">
									<span>Platform charge ({percent}%)</span>
									<strong>{formatGhs(fee)}</strong>
								</Box>
							)}
							<Box className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-base">
								<span>Amount to pay</span>
								<strong>{formatGhs(chargeAmount)}</strong>
							</Box>
						</Box>

						<TextField
							className="mt-2 w-full"
							placeholder="Momo number"
							label="Momo"
							variant="outlined"
							value={transNumber}
							disabled={chargePaid || Boolean(transactionRef)}
							onChange={(event) => {
								const newValue = event.target.value.replace(/\D/g, '').slice(0, 10);
								setTransNumber(newValue);
							}}
							InputLabelProps={{ shrink: true }}
						/>

						<TextField
							select
							fullWidth
							className="mt-3"
							label="Network"
							value={network}
							disabled={chargePaid || Boolean(transactionRef)}
							onChange={(e) => {
								setNetwork(e.target.value);
								setVoucher('');
								setOtp('');
								setOtpStep(false);
							}}
						>
							{MOMO_NETWORK_OPTIONS.map((n) => (
								<MenuItem key={n.provider} value={n.provider}>
									{n.label}
								</MenuItem>
							))}
						</TextField>

						{isTelecel && !chargePaid && !transactionRef && (
							<TextField
								className="mt-3 w-full"
								label="Voucher"
								placeholder="Dial *110# to generate"
								helperText="Telecel Cash voucher required before Send"
								variant="outlined"
								value={voucher}
								onChange={(e) => setVoucher(e.target.value)}
								InputLabelProps={{ shrink: true }}
							/>
						)}

						{!chargePaid && !transactionRef && (
							<Button
								className="my-4 w-full"
								variant="contained"
								color="secondary"
								disabled={
									sending ||
									transNumber.length < 10 ||
									(isTelecel && !voucher.trim())
								}
								onClick={() => handleSend()}
								size={isMobile ? 'small' : 'medium'}
							>
								{sending ? <CircularProgress size={20} color="inherit" /> : <span>Send</span>}
							</Button>
						)}

						{otpStep && !chargePaid && (
							<Box className="mb-2 mt-3">
								<TextField
									fullWidth
									label={isTelecel ? 'Voucher / OTP' : 'OTP (if required)'}
									value={otp}
									onChange={(e) => setOtp(e.target.value)}
									className="mb-2"
									helperText={
										isTelecel
											? 'Re-enter voucher if the first submit failed'
											: undefined
									}
								/>
								<Button
									fullWidth
									variant="outlined"
									disabled={sending || !otp}
									onClick={handleOtp}
								>
									{isTelecel ? 'Submit voucher' : 'Submit OTP'}
								</Button>
							</Box>
						)}

						{transactionRef && !chargePaid && (
							<Box className="mt-2 mb-2 flex flex-col gap-1">
								<Button fullWidth variant="text" disabled={sending} onClick={handleCheckStatus}>
									Check status
								</Button>
								<Button
									fullWidth
									variant="outlined"
									color="secondary"
									disabled={sending || parking}
									onClick={handleParkAndServeNext}
								>
									{parking ? <CircularProgress size={18} color="inherit" /> : 'Park & serve next'}
								</Button>
								<Button
									fullWidth
									variant="text"
									color="inherit"
									disabled={sending || parking}
									onClick={handleCancelAndSendAgain}
								>
									Cancel &amp; send again
								</Button>
							</Box>
						)}

						{transactionRef && chargePaid && (
							<Box className="mt-2 mb-2">
								<Button
									fullWidth
									variant="outlined"
									color="secondary"
									disabled={sending || parking}
									onClick={handleParkAndServeNext}
								>
									{parking ? <CircularProgress size={18} color="inherit" /> : 'Park & serve next'}
								</Button>
								<Typography variant="caption" color="text.secondary" display="block" className="mt-1">
									Save this payment and clear the cart so you can serve another customer. Complete it later from Pending MoMo.
								</Typography>
							</Box>
						)}

						{statusText ? (
							<Alert severity={chargePaid ? 'success' : 'info'} className="mb-2">
								{statusText}
							</Alert>
						) : null}

						{transactionRef ? (
							<Typography variant="caption" color="text.secondary">
								Ref: {transactionRef}
							</Typography>
						) : null}
					</Box>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={() => requestClose(false)}>Cancel</Button>
				<Button
					variant="outlined"
					color="secondary"
					disabled={
						!paymentType ||
						(paymentType === 'Momo' && !chargePaid) ||
						(paymentType === 'Cash' && !cashTenderOk)
					}
					onClick={handleSave}
				>
					<span>{completeLabel}</span>
				</Button>
			</DialogActions>
		</Dialog>
	);
}
