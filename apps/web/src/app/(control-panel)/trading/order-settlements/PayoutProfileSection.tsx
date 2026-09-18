'use client';

import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import {
	useGetMyPayoutProfileQuery,
	useGetPayoutBankOptionsQuery,
	useLazyResolvePayoutAccountQuery,
	useUpdateMyPayoutProfileMutation,
	useRequestMyWithdrawalMutation
} from '../../billing/SubscriptionApi';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';
import { formatPayoutSnapshot } from './settlementUtils';
import { MOMO_NETWORK_OPTIONS } from '@/utils/momoNetworks';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';

type PayoutProfileSectionProps = {
	availableBalance?: number;
	onWithdrawalSubmitted?: () => void;
};

function momoNetworkLabel(net?: string) {
	const n = String(net || '').toLowerCase();
	if (n === 'vodafone' || n === 'telecel' || n === 'vod') return 'Telecel';
	if (n === 'airteltigo' || n === 'tgo' || n === 'at') return 'AirtelTigo';
	return 'MTN';
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<Box className="flex items-start justify-between gap-3">
			<Typography variant="body2" color="text.secondary">
				{label}
			</Typography>
			<Typography variant="body2" fontWeight={600} className="text-right">
				{value}
			</Typography>
		</Box>
	);
}

export default function PayoutProfileSection({ availableBalance = 0, onWithdrawalSubmitted }: PayoutProfileSectionProps) {
	const { data: profile, isLoading } = useGetMyPayoutProfileQuery();
	const { data: ghBanks = [] } = useGetPayoutBankOptionsQuery('ghipss', { skip: false });
	const [updateProfile, { isLoading: saving }] = useUpdateMyPayoutProfileMutation();
	const [requestWithdrawal, { isLoading: requesting }] = useRequestMyWithdrawalMutation();
	const [resolveAccount, { isFetching: resolvingAccount }] = useLazyResolvePayoutAccountQuery();

	const [editingPayout, setEditingPayout] = useState(false);
	const [payoutMethod, setPayoutMethod] = useState<'momo' | 'bank'>('momo');
	const [momoNetwork, setMomoNetwork] = useState('mtn');
	const [momoNumber, setMomoNumber] = useState('');
	const [paystackBankCode, setPaystackBankCode] = useState('');
	const [bankName, setBankName] = useState('');
	const [bankAccountNumber, setBankAccountNumber] = useState('');
	const [bankAccountName, setBankAccountName] = useState('');
	const [accountHolderName, setAccountHolderName] = useState('');
	const [withdrawAmount, setWithdrawAmount] = useState('');
	const [withdrawNote, setWithdrawNote] = useState('');
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [resolveHint, setResolveHint] = useState<string | null>(null);

	const bankOptions = useMemo(
		() => [...ghBanks].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
		[ghBanks]
	);

	const applyProfileFields = (data: typeof profile) => {
		if (!data) return;
		setPayoutMethod((data.payout_method as 'momo' | 'bank') || 'momo');
		setMomoNetwork(String(data.momo_network || 'mtn'));
		setMomoNumber(String(data.momo_number || ''));
		setPaystackBankCode(String(data.paystack_bank_code || ''));
		setBankName(String(data.bank_name || ''));
		setBankAccountNumber(String(data.bank_account_number || ''));
		setBankAccountName(String(data.bank_account_name || ''));
		setAccountHolderName(String(data.account_holder_name || ''));
		setResolveHint(null);
	};

	useEffect(() => {
		if (isLoading) return;
		if (!profile) {
			setEditingPayout(true);
			return;
		}
		applyProfileFields(profile);
		setEditingPayout(false);
	}, [profile, isLoading]);

	useEffect(() => {
		if (!editingPayout || payoutMethod !== 'bank') return;
		const digits = String(bankAccountNumber || '').replace(/\D/g, '');
		if (!paystackBankCode || digits.length < 10) {
			setResolveHint(null);
			return;
		}
		const timer = window.setTimeout(async () => {
			try {
				const resolved = await resolveAccount({
					account_number: digits,
					bank_code: paystackBankCode
				}).unwrap();
				const name = String(resolved?.account_name || '').trim();
				if (!name) {
					setResolveHint('Could not look up this account name.');
					return;
				}
				setBankAccountName(name);
				setAccountHolderName((prev) => prev.trim() || name);
				setResolveHint(resolved?.stub ? 'Demo name (Paystack not configured).' : 'Account name verified.');
			} catch (e: any) {
				setResolveHint(e?.data?.message || e?.message || 'Could not look up this account name.');
			}
		}, 550);
		return () => window.clearTimeout(timer);
	}, [editingPayout, payoutMethod, paystackBankCode, bankAccountNumber, resolveAccount]);

	const onSaveProfile = async () => {
		setMessage(null);
		setError(null);
		try {
			await updateProfile({
				payout_method: payoutMethod,
				momo_network: payoutMethod === 'momo' ? momoNetwork : undefined,
				momo_number: payoutMethod === 'momo' ? momoNumber : undefined,
				bank_name: payoutMethod === 'bank' ? bankName : undefined,
				paystack_bank_code: payoutMethod === 'bank' ? paystackBankCode : undefined,
				bank_account_number: payoutMethod === 'bank' ? bankAccountNumber : undefined,
				bank_account_name: payoutMethod === 'bank' ? bankAccountName : undefined,
				account_holder_name: accountHolderName
			}).unwrap();
			setEditingPayout(false);
			setMessage('Payout details saved.');
		} catch (e: any) {
			setError(e?.data?.message || e?.message || 'Could not save payout details.');
		}
	};

	const onCancelEdit = () => {
		applyProfileFields(profile);
		setEditingPayout(false);
		setError(null);
	};

	const onRequestWithdrawal = async () => {
		setMessage(null);
		setError(null);
		const parsed = Number(withdrawAmount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			setError('Enter a valid withdrawal amount.');
			return;
		}
		try {
			const result = await requestWithdrawal({ amount: parsed, note: withdrawNote.trim() || undefined }).unwrap();
			setWithdrawAmount('');
			setWithdrawNote('');
			const status = String(result?.status || '').toLowerCase();
			if (status === 'paid') {
				setMessage('Withdrawal sent successfully via Paystack.');
			} else if (status === 'processing') {
				setMessage('Withdrawal submitted. Paystack is processing the transfer.');
			} else if (status === 'failed') {
				setError(result?.rejection_reason || 'Paystack could not complete this withdrawal.');
			} else {
				setMessage('Withdrawal submitted.');
			}
			onWithdrawalSubmitted?.();
		} catch (e: any) {
			setError(e?.data?.message || e?.message || 'Could not request withdrawal.');
		}
	};

	const showSummary = Boolean(profile) && !editingPayout;
	const momoOption = MOMO_NETWORK_OPTIONS.find(
		(n) => n.payoutNetwork === String(profile?.momo_network || '').toLowerCase()
	);

	return (
		<Paper variant="outlined" className="mb-6 rounded-xl overflow-hidden" sx={{ borderColor: 'divider' }}>
			<Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }} className="flex items-start justify-between gap-3">
				<Box>
					<Typography fontWeight={700}>Payout details & withdrawal</Typography>
					<Typography variant="body2" color="text.secondary" className="mt-1">
						Save your MoMo or bank details once. Withdrawals are sent automatically through Paystack when you request them.
					</Typography>
				</Box>
				{showSummary ? (
					<Button
						size="small"
						variant="outlined"
						startIcon={<FuseSvgIcon size={16}>heroicons-outline:pencil-square</FuseSvgIcon>}
						onClick={() => setEditingPayout(true)}
						sx={{ textTransform: 'none', flexShrink: 0 }}
					>
						Edit
					</Button>
				) : null}
			</Box>
			<Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
				{message ? <Alert severity="success">{message}</Alert> : null}
				{error ? <Alert severity="error">{error}</Alert> : null}

				{showSummary ? (
					<Box
						sx={{
							border: 1,
							borderColor: 'divider',
							borderRadius: 2,
							p: 2,
							bgcolor: 'action.hover',
							display: 'flex',
							flexDirection: 'column',
							gap: 1.25
						}}
					>
						<DetailRow
							label="Method"
							value={String(profile?.payout_method || '').toLowerCase() === 'bank' ? 'Bank transfer' : 'Mobile money'}
						/>
						{profile?.account_holder_name ? (
							<DetailRow label="Account holder" value={String(profile.account_holder_name)} />
						) : null}
						{String(profile?.payout_method || '').toLowerCase() === 'bank' ? (
							<>
								<DetailRow label="Bank" value={String(profile?.bank_name || '—')} />
								<DetailRow label="Account number" value={String(profile?.bank_account_number || '—')} />
								{profile?.bank_account_name ? (
									<DetailRow label="Account name" value={String(profile.bank_account_name)} />
								) : null}
							</>
						) : (
							<>
								<Box className="flex items-center justify-between gap-3">
									<Typography variant="body2" color="text.secondary">
										Network
									</Typography>
									<Box className="flex items-center gap-2">
										{momoOption?.iconSrc ? (
											<Box
												component="img"
												src={momoOption.iconSrc}
												alt=""
												sx={{ width: 20, height: 20, objectFit: 'contain' }}
											/>
										) : null}
										<Typography variant="body2" fontWeight={600}>
											{momoNetworkLabel(profile?.momo_network)}
										</Typography>
									</Box>
								</Box>
								<DetailRow label="MoMo number" value={String(profile?.momo_number || '—')} />
							</>
						)}
						<Typography variant="caption" color="text.secondary" className="pt-1">
							Destination: {formatPayoutSnapshot(profile)}
						</Typography>
					</Box>
				) : (
					<>
						<TextField
							select
							label="Payout method"
							size="small"
							value={payoutMethod}
							onChange={(e) => setPayoutMethod(e.target.value as 'momo' | 'bank')}
							disabled={isLoading}
						>
							<MenuItem value="momo">Mobile money</MenuItem>
							<MenuItem value="bank">Bank transfer</MenuItem>
						</TextField>

						<TextField
							label="Account holder name"
							size="small"
							value={accountHolderName}
							onChange={(e) => setAccountHolderName(e.target.value)}
							disabled={isLoading}
						/>

						{payoutMethod === 'momo' ? (
							<Box className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<TextField
									select
									label="Network"
									size="small"
									value={momoNetwork}
									onChange={(e) => setMomoNetwork(e.target.value)}
								>
									{MOMO_NETWORK_OPTIONS.map((n) => (
										<MenuItem key={n.payoutNetwork} value={n.payoutNetwork}>
											<Box className="flex items-center gap-2">
												<Box
													component="img"
													src={n.iconSrc}
													alt=""
													sx={{ width: 22, height: 22, objectFit: 'contain' }}
												/>
												{n.label}
											</Box>
										</MenuItem>
									))}
								</TextField>
								<TextField
									label="MoMo number"
									size="small"
									type="tel"
									value={momoNumber}
									onChange={(e) => setMomoNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
									onPaste={(e) => {
										e.preventDefault();
										setMomoNumber(
											String(e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 10)
										);
									}}
									slotProps={{
										htmlInput: {
											inputMode: 'numeric',
											pattern: '[0-9]*',
											autoComplete: 'tel'
										}
									}}
									placeholder="e.g. 0241234567"
								/>
							</Box>
						) : (
							<Box className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<TextField
									select
									label="Bank"
									size="small"
									value={paystackBankCode}
									onChange={(e) => {
										const code = e.target.value;
										setPaystackBankCode(code);
										const match = bankOptions.find((b) => b.code === code);
										setBankName(match?.name || '');
										setBankAccountName('');
										setResolveHint(null);
									}}
								>
									<MenuItem value="">Select bank</MenuItem>
									{bankOptions.map((bank) => (
										<MenuItem key={bank.code} value={bank.code}>
											{bank.name}
										</MenuItem>
									))}
								</TextField>
								<TextField
									label="Account number"
									size="small"
									value={bankAccountNumber}
									onChange={(e) => {
										setBankAccountNumber(e.target.value.replace(/\D/g, ''));
										setResolveHint(null);
									}}
									InputProps={{
										endAdornment: resolvingAccount ? (
											<InputAdornment position="end">
												<CircularProgress size={16} />
											</InputAdornment>
										) : undefined
									}}
								/>
								<TextField
									label="Account name"
									size="small"
									value={bankAccountName}
									onChange={(e) => setBankAccountName(e.target.value)}
									className="sm:col-span-2"
									helperText={
										resolveHint ||
										(paystackBankCode
											? 'Filled automatically after you enter the account number.'
											: 'Select a bank, then enter the account number to look up the name.')
									}
								/>
							</Box>
						)}

						<Box className="flex flex-wrap gap-2">
							{profile ? (
								<Button variant="outlined" onClick={onCancelEdit} disabled={saving}>
									Cancel
								</Button>
							) : null}
							<Button variant="contained" onClick={onSaveProfile} disabled={saving || isLoading}>
								Save payout details
							</Button>
						</Box>
					</>
				)}

				<Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
					<Typography fontWeight={600} className="mb-2">
						Withdraw funds
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mb-2">
						Available: {formatGhsCurrency(availableBalance, 2, 2)}. We validate your balance and send the payout through Paystack to your saved account.
					</Typography>
					<Box className="flex flex-wrap items-end gap-2">
						<TextField
							label="Amount (GHS)"
							type="number"
							size="small"
							value={withdrawAmount}
							onChange={(e) => setWithdrawAmount(e.target.value)}
							sx={{ minWidth: 140 }}
						/>
						<TextField
							label="Note (optional)"
							size="small"
							value={withdrawNote}
							onChange={(e) => setWithdrawNote(e.target.value)}
							sx={{ flex: 1, minWidth: 160 }}
						/>
						<Button variant="outlined" onClick={onRequestWithdrawal} disabled={requesting || !profile}>
							Withdraw funds
						</Button>
					</Box>
				</Box>
			</Box>
		</Paper>
	);
}
