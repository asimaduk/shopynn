'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FuseLoading from '@fuse/core/FuseLoading';
import toast from 'react-hot-toast';
import { type MomoNetwork, useGetMyEarningsQuery, useSavePayoutProfileMutation } from './MerchantApi';
import {
	MOMO_NETWORK_LABEL,
	PAYOUT_STATUS_COLOR,
	PAYOUT_STATUS_LABEL,
	formatDate,
	formatDateShort,
	formatMoney
} from './merchantFormatters';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<Paper variant="outlined" className="flex-1 min-w-[160px] rounded-xl p-4 shadow-none">
			<Typography variant="caption" color="text.secondary" className="font-semibold uppercase tracking-wide">
				{label}
			</Typography>
			<Typography variant="h5" className="mt-1 font-bold">
				GHS {value}
			</Typography>
			{hint ? (
				<Typography variant="caption" color="text.secondary">
					{hint}
				</Typography>
			) : null}
		</Paper>
	);
}

/** Agent: balances by stage, MoMo payout details and payout history. */
export default function AgentEarningsPanel() {
	const { data, isLoading } = useGetMyEarningsQuery(undefined, { refetchOnMountOrArgChange: true });
	const [save, { isLoading: saving }] = useSavePayoutProfileMutation();
	const [network, setNetwork] = useState<MomoNetwork>('mtn');
	const [number, setNumber] = useState('');
	const [holder, setHolder] = useState('');

	const profile = data?.payout_profile ?? null;
	const earnings = data?.earnings;

	useEffect(() => {
		if (profile) {
			setNetwork(profile.momo_network);
			setNumber(profile.momo_number);
			setHolder(profile.account_holder_name);
		}
	}, [profile]);

	const handleSave = async () => {
		try {
			await save({ momo_network: network, momo_number: number.trim(), account_holder_name: holder.trim() }).unwrap();
			toast.success('Payout details saved.');
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; error?: string };
			toast.error(err?.data?.message || err?.error || 'Could not save payout details');
		}
	};

	if (isLoading || !earnings) {
		return (
			<Box className="flex min-h-[200px] items-center justify-center p-8">
				<FuseLoading />
			</Box>
		);
	}

	return (
		<Box className="flex flex-col gap-6 p-4">
			<Box className="flex flex-wrap gap-3">
				<Stat
					label="On hold"
					value={formatMoney(earnings.held_ghs)}
					hint={
						earnings.next_release_at
							? `Next release ${formatDateShort(earnings.next_release_at)}`
							: '30-day hold after each payment'
					}
				/>
				<Stat label="Payable" value={formatMoney(earnings.payable_ghs)} hint={`Paid out from GHS ${earnings.payout_min_ghs}`} />
				<Stat label="In payout" value={formatMoney(earnings.in_payout_ghs)} hint="Awaiting Shopynn approval" />
				<Stat label="Paid" value={formatMoney(earnings.paid_ghs)} />
			</Box>

			<Typography variant="body2" color="text.secondary">
				{earnings.payout_schedule}. Commission is held for 30 days after the shop pays, then becomes payable. Payouts
				go to your mobile money number with no fee to you.
			</Typography>

			<Paper variant="outlined" className="rounded-xl p-4 shadow-none">
				<Typography variant="subtitle1" className="mb-3 font-bold">
					Mobile money payout details
				</Typography>
				{!profile ? (
					<Alert severity="warning" className="mb-3">
						Add your MoMo details so your commission can be paid.
					</Alert>
				) : null}
				<Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<TextField
						select
						label="Network"
						size="small"
						value={network}
						onChange={(e) => setNetwork(e.target.value as MomoNetwork)}
					>
						{Object.entries(MOMO_NETWORK_LABEL).map(([value, label]) => (
							<MenuItem key={value} value={value}>
								{label}
							</MenuItem>
						))}
					</TextField>
					<TextField
						label="MoMo number"
						size="small"
						value={number}
						onChange={(e) => setNumber(e.target.value)}
						placeholder="024xxxxxxx"
					/>
					<TextField
						label="Name on the MoMo account"
						size="small"
						value={holder}
						onChange={(e) => setHolder(e.target.value)}
					/>
				</Box>
				<Box className="mt-3 flex justify-end">
					<Button variant="contained" color="secondary" onClick={handleSave} disabled={saving || !number.trim() || !holder.trim()}>
						Save details
					</Button>
				</Box>
			</Paper>

			<Box>
				<Typography variant="subtitle1" className="mb-2 font-bold">
					Payouts
				</Typography>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Prepared</TableCell>
							<TableCell align="right">Amount</TableCell>
							<TableCell align="right">Commissions</TableCell>
							<TableCell>Status</TableCell>
							<TableCell>Paid</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{earnings.payouts.map((p) => (
							<TableRow key={p.id}>
								<TableCell>{formatDate(p.created_at)}</TableCell>
								<TableCell align="right">GHS {formatMoney(p.amount)}</TableCell>
								<TableCell align="right">{p.commission_count}</TableCell>
								<TableCell>
									<Chip size="small" variant="outlined" label={PAYOUT_STATUS_LABEL[p.status]} color={PAYOUT_STATUS_COLOR[p.status]} />
								</TableCell>
								<TableCell>{formatDate(p.paid_at)}</TableCell>
							</TableRow>
						))}
						{earnings.payouts.length === 0 && (
							<TableRow>
								<TableCell colSpan={5}>
									<Typography color="text.secondary">No payouts yet.</Typography>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</Box>
		</Box>
	);
}
