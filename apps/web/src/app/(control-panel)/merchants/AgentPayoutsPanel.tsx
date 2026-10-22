'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FuseLoading from '@fuse/core/FuseLoading';
import toast from 'react-hot-toast';
import {
	type AgentPayoutRow,
	type PayoutStatus,
	useApproveAgentPayoutMutation,
	useGetAgentPayoutsQuery,
	useMarkAgentPayoutFailedMutation,
	usePrepareAgentPayoutsMutation,
	useRejectAgentPayoutMutation
} from './MerchantApi';
import {
	MOMO_NETWORK_LABEL,
	PAYOUT_STATUS_COLOR,
	PAYOUT_STATUS_LABEL,
	formatDate,
	formatMoney
} from './merchantFormatters';

function payoutAgentName(p: AgentPayoutRow) {
	return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || p.phone || 'Agent';
}

function errorMessage(e: unknown, fallback: string) {
	const err = e as { data?: { message?: string }; error?: string };
	return err?.data?.message || err?.error || fallback;
}

/** Platform admin: weekly agent payout queue — approve sends MoMo via Paystack. */
export default function AgentPayoutsPanel() {
	const [status, setStatus] = useState<PayoutStatus | ''>('');
	const { data, isLoading } = useGetAgentPayoutsQuery(status ? { status } : undefined, {
		refetchOnMountOrArgChange: true
	});
	const [prepare, { isLoading: preparing }] = usePrepareAgentPayoutsMutation();
	const [approve, { isLoading: approving }] = useApproveAgentPayoutMutation();
	const [reject, { isLoading: rejecting }] = useRejectAgentPayoutMutation();
	const [markFailed, { isLoading: marking }] = useMarkAgentPayoutFailedMutation();
	const busy = preparing || approving || rejecting || marking;

	const payouts = data?.payouts ?? [];
	const awaiting = payouts.filter((p) => p.status === 'pending_approval');
	const awaitingTotal = awaiting.reduce((s, p) => s + Number(p.amount || 0), 0);

	const handlePrepare = async () => {
		try {
			const res = await prepare().unwrap();
			const skipped = res.skipped_no_profile.length
				? ` ${res.skipped_no_profile.length} agent(s) skipped: no MoMo details (${res.skipped_no_profile.map((s) => s.name).join(', ')}).`
				: '';
			toast.success(`${res.created.length} payout(s) prepared.${skipped}`, { duration: 6000 });
		} catch (e) {
			toast.error(errorMessage(e, 'Could not prepare payouts'));
		}
	};

	const handleApprove = async (p: AgentPayoutRow) => {
		const momo = p.payout_snapshot;
		const to = momo ? `${MOMO_NETWORK_LABEL[momo.momo_network ?? ''] ?? momo.momo_network} ${momo.momo_number}` : 'their MoMo';
		if (!window.confirm(`Send GHS ${formatMoney(p.amount)} to ${payoutAgentName(p)} (${to})?`)) return;
		try {
			const res = await approve(p.id).unwrap();
			const s = res.payout.status;
			if (s === 'paid') toast.success('Payout sent.');
			else if (s === 'failed') toast.error(`Payout failed: ${res.payout.failure_reason ?? 'unknown error'}`);
			else toast.success('Sent to Paystack; waiting for confirmation.');
		} catch (e) {
			toast.error(errorMessage(e, 'Could not send payout'));
		}
	};

	const handleReject = async (p: AgentPayoutRow) => {
		const reason = window.prompt('Reason for rejecting this payout (optional). Its commissions become payable again.');
		if (reason === null) return;
		try {
			await reject({ id: p.id, reason }).unwrap();
			toast.success('Payout rejected.');
		} catch (e) {
			toast.error(errorMessage(e, 'Could not reject payout'));
		}
	};

	const handleMarkFailed = async (p: AgentPayoutRow) => {
		if (!window.confirm('Only mark failed after confirming on the Paystack dashboard that this transfer did not go through. Continue?')) return;
		try {
			await markFailed({ id: p.id }).unwrap();
			toast.success('Marked failed. You can retry or reject it.');
		} catch (e) {
			toast.error(errorMessage(e, 'Could not update payout'));
		}
	};

	return (
		<Box className="flex flex-col gap-3 p-4">
			{data?.live_transfers_blocked ? (
				<Alert severity="info">
					Real agent payouts are switched off. Set AGENT_PAYOUTS_ENABLED=true on the API when you are ready to send
					money.
				</Alert>
			) : null}
			<Box className="flex flex-wrap items-center justify-between gap-2">
				<Typography variant="body2" color="text.secondary">
					Payouts are prepared every Monday for agents with at least GHS 50 payable and MoMo details on file.
					{awaiting.length > 0 ? ` ${awaiting.length} awaiting approval (GHS ${formatMoney(awaitingTotal)}).` : ''}
				</Typography>
				<Box className="flex items-center gap-2">
					<TextField
						select
						size="small"
						label="Status"
						value={status}
						onChange={(e) => setStatus(e.target.value as PayoutStatus | '')}
						sx={{ minWidth: 170 }}
					>
						<MenuItem value="">All</MenuItem>
						{Object.entries(PAYOUT_STATUS_LABEL).map(([value, label]) => (
							<MenuItem key={value} value={value}>
								{label}
							</MenuItem>
						))}
					</TextField>
					<Button variant="outlined" onClick={handlePrepare} disabled={busy}>
						Prepare payouts now
					</Button>
				</Box>
			</Box>

			{isLoading ? (
				<Box className="flex min-h-[200px] items-center justify-center p-8">
					<FuseLoading />
				</Box>
			) : (
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Agent</TableCell>
							<TableCell>MoMo</TableCell>
							<TableCell align="right">Amount</TableCell>
							<TableCell align="right">Commissions</TableCell>
							<TableCell>Status</TableCell>
							<TableCell>Prepared</TableCell>
							<TableCell align="right">Actions</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{payouts.map((p) => (
							<TableRow key={p.id} hover>
								<TableCell>
									<div className="font-medium">{payoutAgentName(p)}</div>
									<Typography variant="caption" color="text.secondary">
										{p.agent_type === 'manager' ? 'Agent manager' : 'Field agent'}
									</Typography>
								</TableCell>
								<TableCell>
									{p.payout_snapshot
										? `${MOMO_NETWORK_LABEL[p.payout_snapshot.momo_network ?? ''] ?? p.payout_snapshot.momo_network} · ${p.payout_snapshot.momo_number}`
										: '—'}
									<Typography variant="caption" color="text.secondary" component="div">
										{p.payout_snapshot?.account_holder_name ?? ''}
									</Typography>
								</TableCell>
								<TableCell align="right">GHS {formatMoney(p.amount)}</TableCell>
								<TableCell align="right">{p.commission_count}</TableCell>
								<TableCell>
									<Chip size="small" variant="outlined" label={PAYOUT_STATUS_LABEL[p.status]} color={PAYOUT_STATUS_COLOR[p.status]} />
									{p.failure_reason ? (
										<Typography variant="caption" color="error" component="div" className="max-w-[240px]">
											{p.failure_reason}
										</Typography>
									) : null}
								</TableCell>
								<TableCell>{formatDate(p.created_at)}</TableCell>
								<TableCell align="right">
									<Box className="flex justify-end gap-1">
										{p.status === 'pending_approval' || p.status === 'failed' ? (
											<>
												<Button size="small" variant="contained" color="secondary" disabled={busy} onClick={() => handleApprove(p)}>
													{p.status === 'failed' ? 'Retry' : 'Approve & send'}
												</Button>
												<Button size="small" disabled={busy} onClick={() => handleReject(p)}>
													Reject
												</Button>
											</>
										) : p.status === 'processing' ? (
											<Button size="small" color="warning" disabled={busy} onClick={() => handleMarkFailed(p)}>
												Mark failed
											</Button>
										) : (
											'—'
										)}
									</Box>
								</TableCell>
							</TableRow>
						))}
						{payouts.length === 0 && (
							<TableRow>
								<TableCell colSpan={7}>
									<Typography color="text.secondary">No payouts{status ? ' with this status' : ''}.</Typography>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			)}
		</Box>
	);
}
