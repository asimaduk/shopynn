'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import {
	useListAdminWithdrawalRequestsQuery,
	useApproveAdminSettlementMutation,
	useRejectAdminSettlementMutation,
	useMarkAdminSettlementPaidMutation
} from '../TenantsDirectoryApi';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';
import { formatDate } from '../../merchants/merchantFormatters';
import { formatPayoutSnapshot, settlementStatusColor, settlementStatusLabel } from '../../trading/order-settlements/settlementUtils';

export default function WithdrawalRequestsPage() {
	const [statusFilter, setStatusFilter] = useState<'processing' | 'requested' | 'failed'>('processing');
	const [payoutRefById, setPayoutRefById] = useState<Record<string, string>>({});
	const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});

	const { data: rows = [], isLoading, refetch } = useListAdminWithdrawalRequestsQuery({ status: statusFilter });
	const [approve, { isLoading: approving }] = useApproveAdminSettlementMutation();
	const [reject, { isLoading: rejecting }] = useRejectAdminSettlementMutation();
	const [markPaid, { isLoading: markingPaid }] = useMarkAdminSettlementPaidMutation();

	const refresh = () => refetch();

	return (
		<PlanFeatureGate requiredFeatures={['tenants.directory.view']} requiredPermissions={['tenants.directory.view']}>
			<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8">
				<PageBreadcrumb className="mb-2 mt-6" />
				<Typography component="h1" className="text-3xl font-extrabold tracking-tight">
					Withdrawal requests
				</Typography>
				<Typography variant="body2" color="text.secondary" className="mb-4 mt-1">
					Monitor Paystack merchant withdrawals. Most payouts run automatically; use this queue for processing or failed transfers.
				</Typography>

				<Box className="mb-4 flex flex-wrap gap-2">
					<Button variant={statusFilter === 'processing' ? 'contained' : 'outlined'} onClick={() => setStatusFilter('processing')}>
						Processing
					</Button>
					<Button variant={statusFilter === 'requested' ? 'contained' : 'outlined'} onClick={() => setStatusFilter('requested')}>
						Awaiting review
					</Button>
					<Button variant={statusFilter === 'failed' ? 'contained' : 'outlined'} onClick={() => setStatusFilter('failed')}>
						Failed
					</Button>
				</Box>

				{isLoading ? (
					<FuseLoading />
				) : rows.length === 0 ? (
					<Paper variant="outlined" sx={{ p: 4, borderRadius: 2 }}>
						<Typography color="text.secondary">No {statusFilter} withdrawal requests.</Typography>
					</Paper>
				) : (
					<Box className="flex flex-col gap-3">
						{rows.map((row: any) => {
							const status = String(row.status || '').toLowerCase();
							const isRequested = status === 'requested';
							const isPending = status === 'pending';
							const isProcessing = status === 'processing';
							const isFailed = status === 'failed';
							return (
								<Paper key={row.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
									<Box className="flex flex-wrap items-start justify-between gap-2">
										<Box>
											<Typography fontWeight={700}>{row.tenant_name || row.tenant_organization || row.tenant_id}</Typography>
											<Typography fontWeight={600}>{formatGhsCurrency(Number(row.amount || 0), 2, 2)}</Typography>
											<Typography variant="caption" color="text.secondary">
												{formatDate(row.created_at ?? undefined)}
											</Typography>
											{row.payout_snapshot ? (
												<Typography variant="body2" color="text.secondary" className="mt-1">
													Pay to: {formatPayoutSnapshot(row.payout_snapshot)}
												</Typography>
											) : null}
											{row.paystack_transfer_reference ? (
												<Typography variant="caption" color="text.secondary" display="block" className="mt-1">
													Paystack ref: {row.paystack_transfer_reference}
												</Typography>
											) : null}
											{row.rejection_reason ? (
												<Typography variant="caption" color="error.main" display="block" className="mt-1">
													{row.rejection_reason}
												</Typography>
											) : null}
										</Box>
										<Chip size="small" label={settlementStatusLabel(status)} color={settlementStatusColor(status)} />
									</Box>
									{isRequested ? (
										<Box className="mt-3 flex flex-wrap items-center gap-2">
											<TextField
												size="small"
												placeholder="Rejection reason"
												value={rejectReasonById[row.id] ?? ''}
												onChange={(e) => setRejectReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
												sx={{ flex: 1, minWidth: 180 }}
											/>
											<Button
												size="small"
												variant="contained"
												disabled={approving}
												onClick={async () => {
													await approve(row.id).unwrap();
													refresh();
												}}
											>
												Approve
											</Button>
											<Button
												size="small"
												color="error"
												variant="outlined"
												disabled={rejecting}
												onClick={async () => {
													await reject({ id: row.id, reason: rejectReasonById[row.id]?.trim() || undefined }).unwrap();
													refresh();
												}}
											>
												Reject
											</Button>
										</Box>
									) : null}
									{isPending ? (
										<Box className="mt-3 flex flex-wrap items-center gap-2">
											<TextField
												size="small"
												placeholder="Payout reference"
												value={payoutRefById[row.id] ?? ''}
												onChange={(e) => setPayoutRefById((prev) => ({ ...prev, [row.id]: e.target.value }))}
												sx={{ width: 180 }}
											/>
											<Button
												size="small"
												variant="outlined"
												disabled={markingPaid}
												onClick={async () => {
													await markPaid({ id: row.id, payout_reference: payoutRefById[row.id]?.trim() || undefined }).unwrap();
													refresh();
												}}
											>
												Mark paid
											</Button>
										</Box>
									) : null}
									{isProcessing ? (
										<Typography variant="body2" color="text.secondary" className="mt-2">
											Paystack is processing this transfer. Status updates via webhook.
										</Typography>
									) : null}
									{isFailed ? (
										<Typography variant="body2" color="text.secondary" className="mt-2">
											Transfer failed. Merchant can submit a new withdrawal after fixing payout details.
										</Typography>
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
