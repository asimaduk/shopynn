'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import toast from 'react-hot-toast';
import {
	useListAdminWithdrawalRequestsQuery,
	useApproveAdminSettlementMutation,
	useRejectAdminSettlementMutation,
	useMarkAdminSettlementPaidMutation
} from '../TenantsDirectoryApi';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';
import { formatDate } from '../../merchants/merchantFormatters';
import {
	formatPayoutSnapshot,
	settlementStatusColor,
	settlementStatusLabel
} from '../../trading/order-settlements/settlementUtils';

type QueueStatus = 'processing' | 'requested' | 'failed';

const QUEUES: {
	id: QueueStatus;
	label: string;
	hint: string;
	emptyTitle: string;
	emptyBody: string;
	icon: string;
}[] = [
	{
		id: 'processing',
		label: 'Processing',
		hint: 'Paystack transfer in flight',
		emptyTitle: 'No transfers in progress',
		emptyBody:
			'When a merchant withdraws and auto-payout is on, requests appear here until Paystack confirms success or failure.',
		icon: 'heroicons-outline:arrow-path'
	},
	{
		id: 'requested',
		label: 'Awaiting review',
		hint: 'Needs your approve / reject',
		emptyTitle: 'Nothing waiting for review',
		emptyBody:
			'Manual-approval withdrawals land here when auto-payout is off. Approve to send via Paystack, or reject with a reason.',
		icon: 'heroicons-outline:clipboard-document-check'
	},
	{
		id: 'failed',
		label: 'Failed',
		hint: 'Transfer failed',
		emptyTitle: 'No failed withdrawals',
		emptyBody:
			'Failed Paystack transfers show here. Merchants can fix payout details and retry from Order Settlements.',
		icon: 'heroicons-outline:exclamation-triangle'
	}
];

export default function WithdrawalRequestsPage() {
	const [statusFilter, setStatusFilter] = useState<QueueStatus>('processing');
	const [payoutRefById, setPayoutRefById] = useState<Record<string, string>>({});
	const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});
	const [actionError, setActionError] = useState('');

	const { data: processingRows = [], refetch: refetchProcessing } = useListAdminWithdrawalRequestsQuery({
		status: 'processing'
	});
	const { data: requestedRows = [], refetch: refetchRequested } = useListAdminWithdrawalRequestsQuery({
		status: 'requested'
	});
	const { data: failedRows = [], refetch: refetchFailed } = useListAdminWithdrawalRequestsQuery({
		status: 'failed'
	});

	const { data: rows = [], isLoading, isFetching, refetch } = useListAdminWithdrawalRequestsQuery({
		status: statusFilter
	});
	const [approve, { isLoading: approving }] = useApproveAdminSettlementMutation();
	const [reject, { isLoading: rejecting }] = useRejectAdminSettlementMutation();
	const [markPaid, { isLoading: markingPaid }] = useMarkAdminSettlementPaidMutation();

	const counts = useMemo(
		() => ({
			processing: processingRows.length,
			requested: requestedRows.length,
			failed: failedRows.length
		}),
		[processingRows.length, requestedRows.length, failedRows.length]
	);

	const activeQueue = QUEUES.find((q) => q.id === statusFilter) || QUEUES[0];

	const refreshAll = () => {
		refetch();
		refetchProcessing();
		refetchRequested();
		refetchFailed();
	};

	const handleApprove = async (id: string) => {
		setActionError('');
		try {
			await approve(id).unwrap();
			toast.success('Withdrawal approved');
			refreshAll();
		} catch (err: any) {
			const msg = err?.data?.message || err?.message || 'Could not approve';
			setActionError(msg);
			toast.error(msg);
		}
	};

	const handleReject = async (id: string) => {
		setActionError('');
		try {
			await reject({ id, reason: rejectReasonById[id]?.trim() || undefined }).unwrap();
			toast.success('Withdrawal rejected');
			refreshAll();
		} catch (err: any) {
			const msg = err?.data?.message || err?.message || 'Could not reject';
			setActionError(msg);
			toast.error(msg);
		}
	};

	const handleMarkPaid = async (id: string) => {
		setActionError('');
		try {
			await markPaid({
				id,
				payout_reference: payoutRefById[id]?.trim() || undefined
			}).unwrap();
			toast.success('Marked paid');
			refreshAll();
		} catch (err: any) {
			const msg = err?.data?.message || err?.message || 'Could not mark paid';
			setActionError(msg);
			toast.error(msg);
		}
	};

	return (
		<PlanFeatureGate requiredFeatures={['tenants.directory.view']} requiredPermissions={['tenants.directory.view']}>
			<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
				<PageBreadcrumb className="mb-4" />

				<Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
					<Box className="min-w-0 max-w-2xl">
						<Typography component="h1" className="text-3xl font-extrabold tracking-tight">
							Withdrawal requests
						</Typography>
						<Typography variant="body2" color="text.secondary" className="mt-1">
							Queue for merchant Paystack withdrawals. Auto-payouts usually finish without action here.
						</Typography>
					</Box>
					<Tooltip title="Refresh queues">
						<span>
							<IconButton onClick={refreshAll} disabled={isFetching} aria-label="Refresh">
								<FuseSvgIcon size={22}>heroicons-outline:arrow-path</FuseSvgIcon>
							</IconButton>
						</span>
					</Tooltip>
				</Box>

				<Alert severity="info" className="mb-4" icon={<FuseSvgIcon size={20}>heroicons-outline:information-circle</FuseSvgIcon>}>
					<strong>How payouts work:</strong> Merchants withdraw from{' '}
					<em>Trading → Order Settlements</em>. Paystack sends to their MoMo/bank. Use{' '}
					<strong>Tenants → tenant details</strong> only for offline/manual payout bookkeeping.
				</Alert>

				{actionError ? (
					<Alert severity="error" className="mb-3" onClose={() => setActionError('')}>
						{actionError}
					</Alert>
				) : null}

				<Paper
					elevation={0}
					className="mb-4"
					sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}
				>
					<ToggleButtonGroup
						exclusive
						fullWidth
						size="small"
						value={statusFilter}
						onChange={(_e, next: QueueStatus | null) => {
							if (next) {
								setActionError('');
								setStatusFilter(next);
							}
						}}
						sx={{
							display: 'grid',
							gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
							gap: 0.5,
							'& .MuiToggleButton-root': {
								border: 0,
								borderRadius: 1.5,
								textTransform: 'none',
								py: 1.25,
								px: 1.5,
								alignItems: 'flex-start',
								justifyContent: 'flex-start'
							}
						}}
					>
						{QUEUES.map((q) => (
							<ToggleButton key={q.id} value={q.id}>
								<Box className="flex w-full items-start gap-2 text-left">
									<FuseSvgIcon size={18} className="mt-0.5 shrink-0">
										{q.icon}
									</FuseSvgIcon>
									<Box className="min-w-0 flex-1">
										<Box className="flex items-center gap-1.5">
											<Typography variant="body2" fontWeight={700} component="span">
												{q.label}
											</Typography>
											<Chip
												size="small"
												label={counts[q.id]}
												sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11, fontWeight: 700 } }}
												color={counts[q.id] > 0 && q.id !== 'processing' ? (q.id === 'failed' ? 'error' : 'warning') : 'default'}
												variant={counts[q.id] > 0 ? 'filled' : 'outlined'}
											/>
										</Box>
										<Typography variant="caption" color="text.secondary" className="block leading-snug">
											{q.hint}
										</Typography>
									</Box>
								</Box>
							</ToggleButton>
						))}
					</ToggleButtonGroup>
				</Paper>

				{isLoading ? (
					<Box className="flex min-h-[200px] items-center justify-center">
						<FuseLoading />
					</Box>
				) : rows.length === 0 ? (
					<Paper
						elevation={0}
						sx={{
							border: 1,
							borderColor: 'divider',
							borderRadius: 2,
							px: 3,
							py: 6,
							textAlign: 'center'
						}}
					>
						<Box
							className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
							sx={{ bgcolor: 'action.hover' }}
						>
							<FuseSvgIcon size={26} color="action">
								{activeQueue.icon}
							</FuseSvgIcon>
						</Box>
						<Typography fontWeight={700} className="mb-1">
							{activeQueue.emptyTitle}
						</Typography>
						<Typography variant="body2" color="text.secondary" className="mx-auto max-w-md">
							{activeQueue.emptyBody}
						</Typography>
					</Paper>
				) : (
					<Box className="flex flex-col gap-3">
						{rows.map((row: any) => {
							const status = String(row.status || '').toLowerCase();
							const isRequested = status === 'requested';
							const isPending = status === 'pending';
							const isProcessing = status === 'processing';
							const isFailed = status === 'failed';
							const requester = [row.requested_by_first_name, row.requested_by_last_name]
								.filter(Boolean)
								.join(' ');
							const business = row.tenant_name || row.tenant_organization || 'Unknown business';

							return (
								<Paper
									key={row.id}
									elevation={0}
									sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2.5 }}
								>
									<Box className="flex flex-wrap items-start justify-between gap-3">
										<Box className="min-w-0 flex-1">
											<Typography variant="overline" color="text.secondary" className="leading-none">
												Business
											</Typography>
											<Typography fontWeight={700} className="truncate text-lg">
												{business}
											</Typography>
											{row.tenant_organization && row.tenant_name !== row.tenant_organization ? (
												<Typography variant="body2" color="text.secondary">
													{row.tenant_organization}
												</Typography>
											) : null}
										</Box>
										<Box className="text-right">
											<Typography variant="h5" fontWeight={800} className="tabular-nums">
												{formatGhsCurrency(Number(row.amount || 0), 2, 2)}
											</Typography>
											<Chip
												size="small"
												className="mt-1"
												label={settlementStatusLabel(status)}
												color={settlementStatusColor(status)}
											/>
										</Box>
									</Box>

									<Divider className="my-3" />

									<Box className="grid gap-2 sm:grid-cols-2">
										<Box>
											<Typography variant="caption" color="text.secondary">
												Destination
											</Typography>
											<Typography variant="body2" fontWeight={600}>
												{formatPayoutSnapshot(row.payout_snapshot)}
											</Typography>
										</Box>
										<Box>
											<Typography variant="caption" color="text.secondary">
												Requested
											</Typography>
											<Typography variant="body2">
												{formatDate(row.created_at ?? undefined)}
												{requester ? ` · ${requester}` : ''}
											</Typography>
										</Box>
										{row.paystack_transfer_reference ? (
											<Box className="sm:col-span-2">
												<Typography variant="caption" color="text.secondary">
													Paystack reference
												</Typography>
												<Typography variant="body2" className="font-mono text-sm">
													{row.paystack_transfer_reference}
												</Typography>
											</Box>
										) : null}
										{row.note ? (
											<Box className="sm:col-span-2">
												<Typography variant="caption" color="text.secondary">
													Note
												</Typography>
												<Typography variant="body2">{row.note}</Typography>
											</Box>
										) : null}
										{row.rejection_reason ? (
											<Box className="sm:col-span-2">
												<Typography variant="caption" color="error">
													Failure / rejection
												</Typography>
												<Typography variant="body2" color="error.main">
													{row.rejection_reason}
												</Typography>
											</Box>
										) : null}
									</Box>

									{isRequested ? (
										<Box className="mt-3 flex flex-wrap items-center gap-2 border-t border-divider pt-3">
											<TextField
												size="small"
												placeholder="Rejection reason (optional)"
												value={rejectReasonById[row.id] ?? ''}
												onChange={(e) =>
													setRejectReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))
												}
												sx={{ flex: 1, minWidth: 180 }}
											/>
											<Button
												size="small"
												variant="contained"
												disabled={approving}
												onClick={() => handleApprove(row.id)}
											>
												Approve &amp; pay
											</Button>
											<Button
												size="small"
												color="error"
												variant="outlined"
												disabled={rejecting}
												onClick={() => handleReject(row.id)}
											>
												Reject
											</Button>
										</Box>
									) : null}

									{isPending ? (
										<Box className="mt-3 flex flex-wrap items-center gap-2 border-t border-divider pt-3">
											<TextField
												size="small"
												placeholder="Payout reference"
												value={payoutRefById[row.id] ?? ''}
												onChange={(e) =>
													setPayoutRefById((prev) => ({ ...prev, [row.id]: e.target.value }))
												}
												sx={{ width: 200 }}
											/>
											<Button
												size="small"
												variant="outlined"
												disabled={markingPaid}
												onClick={() => handleMarkPaid(row.id)}
											>
												Mark paid
											</Button>
										</Box>
									) : null}

									{isProcessing ? (
										<Alert severity="warning" className="mt-3" variant="outlined">
											Paystack is processing this transfer. Status updates when the webhook arrives —
											refresh if it looks stuck.
										</Alert>
									) : null}

									{isFailed ? (
										<Alert severity="error" className="mt-3" variant="outlined">
											Transfer failed. Ask the merchant to check MoMo/bank details on Order Settlements
											and submit a new withdrawal (or use Retry if available).
										</Alert>
									) : null}
								</Paper>
							);
						})}
					</Box>
				)}
			</Box>
		</PlanFeatureGate>
	);
}
