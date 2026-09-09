'use client';

import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import {
	useGetMyPayoutProfileQuery,
	useGetPayoutBankOptionsQuery,
	useUpdateMyPayoutProfileMutation,
	useRequestMyWithdrawalMutation
} from '../../billing/SubscriptionApi';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';
import { formatPayoutSnapshot } from './settlementUtils';
import { MOMO_NETWORK_OPTIONS } from '@/utils/momoNetworks';

type PayoutProfileSectionProps = {
	availableBalance?: number;
	onWithdrawalSubmitted?: () => void;
};

export default function PayoutProfileSection({ availableBalance = 0, onWithdrawalSubmitted }: PayoutProfileSectionProps) {
	const { data: profile, isLoading } = useGetMyPayoutProfileQuery();
	const { data: ghBanks = [] } = useGetPayoutBankOptionsQuery('ghipss', { skip: false });
	const [updateProfile, { isLoading: saving }] = useUpdateMyPayoutProfileMutation();
	const [requestWithdrawal, { isLoading: requesting }] = useRequestMyWithdrawalMutation();

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

	const bankOptions = useMemo(
		() => [...ghBanks].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
		[ghBanks]
	);

	useEffect(() => {
		if (!profile) return;
		setPayoutMethod((profile.payout_method as 'momo' | 'bank') || 'momo');
		setMomoNetwork(String(profile.momo_network || 'mtn'));
		setMomoNumber(String(profile.momo_number || ''));
		setPaystackBankCode(String(profile.paystack_bank_code || ''));
		setBankName(String(profile.bank_name || ''));
		setBankAccountNumber(String(profile.bank_account_number || ''));
		setBankAccountName(String(profile.bank_account_name || ''));
		setAccountHolderName(String(profile.account_holder_name || ''));
	}, [profile]);

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
			setMessage('Payout details saved.');
		} catch (e: any) {
			setError(e?.data?.message || e?.message || 'Could not save payout details.');
		}
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

	return (
		<Paper variant="outlined" className="mb-6 rounded-xl overflow-hidden" sx={{ borderColor: 'divider' }}>
			<Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
				<Typography fontWeight={700}>Payout details & withdrawal</Typography>
				<Typography variant="body2" color="text.secondary" className="mt-1">
					Save your MoMo or bank details once. Withdrawals are sent automatically through Paystack when you request them.
				</Typography>
			</Box>
			<Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
				{message ? <Alert severity="success">{message}</Alert> : null}
				{error ? <Alert severity="error">{error}</Alert> : null}

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
							value={momoNumber}
							onChange={(e) => setMomoNumber(e.target.value)}
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
							onChange={(e) => setBankAccountNumber(e.target.value)}
						/>
						<TextField
							label="Account name"
							size="small"
							value={bankAccountName}
							onChange={(e) => setBankAccountName(e.target.value)}
							className="sm:col-span-2"
						/>
					</Box>
				)}

				<Box className="flex flex-wrap gap-2">
					<Button variant="contained" onClick={onSaveProfile} disabled={saving || isLoading}>
						Save payout details
					</Button>
					{profile ? (
						<Typography variant="caption" color="text.secondary" className="self-center">
							Saved destination: {formatPayoutSnapshot(profile)}
						</Typography>
					) : null}
				</Box>

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
