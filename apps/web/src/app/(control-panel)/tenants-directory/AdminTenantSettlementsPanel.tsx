'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FuseLoading from '@fuse/core/FuseLoading';
import {
	useGetAdminTenantSettlementSummaryQuery,
	useGetAdminTenantSettlementsQuery,
	useCreateAdminTenantSettlementMutation,
	useMarkAdminSettlementPaidMutation,
	useApproveAdminSettlementMutation,
	useRejectAdminSettlementMutation
} from './TenantsDirectoryApi';
import { formatGhsCurrency } from '../dashboards/analytics/daily-sales/formatGhsCurrency';
import { formatDate } from '../merchants/merchantFormatters';
import {
	formatPayoutSnapshot,
	settlementStatusColor,
	settlementStatusLabel
} from '../trading/order-settlements/settlementUtils';

type AdminTenantSettlementsPanelProps = {
	tenantId: string;
};

export default function AdminTenantSettlementsPanel({ tenantId }: AdminTenantSettlementsPanelProps) {
	const [amount, setAmount] = useState('');
	const [note, setNote] = useState('');
	const [payoutRefById, setPayoutRefById] = useState<Record<string, string>>({});
	const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});

	const { data: summary, isFetching: summaryLoading, refetch: refetchSummary } = useGetAdminTenantSettlementSummaryQuery(tenantId);
	const { data: rows = [], isFetching: rowsLoading, refetch: refetchRows } = useGetAdminTenantSettlementsQuery(tenantId);
	const [createSettlement, { isLoading: creating }] = useCreateAdminTenantSettlementMutation();
	const [markPaid, { isLoading: markingPaid }] = useMarkAdminSettlementPaidMutation();
	const [approve, { isLoading: approving }] = useApproveAdminSettlementMutation();
	const [reject, { isLoading: rejecting }] = useRejectAdminSettlementMutation();

	const refresh = () => {
		refetchSummary();
		refetchRows();
	};

	const onCreate = async () => {
		const parsed = Number(amount);
		if (!Number.isFinite(parsed) || parsed <= 0) return;
		try {
			await createSettlement({ tenantId, amount: parsed, note: note.trim() || undefined }).unwrap();
			setAmount('');
			setNote('');
			refresh();
		} catch (_) {
			/* ignore */
		}
	};

	const onApprove = async (id: string) => {
		try {
			await approve(id).unwrap();
			refresh();
		} catch (_) {
			/* ignore */
		}
	};

	const onReject = async (id: string) => {
		try {
			await reject({ id, reason: rejectReasonById[id]?.trim() || undefined }).unwrap();
			refresh();
		} catch (_) {
			/* ignore */
		}
	};

	const onMarkPaid = async (id: string) => {
		try {
			await markPaid({
				id,
				payout_reference: payoutRefById[id]?.trim() || undefined
			}).unwrap();
			refresh();
		} catch (_) {
			/* ignore */
		}
	};

	if (summaryLoading && rowsLoading && !summary) {
		return (
			<Box className="flex min-h-[80px] items-center justify-center py-4">
				<FuseLoading />
			</Box>
		);
	}

	return (
		<Box>
			<Typography variant="subtitle1" fontWeight={700} className="mb-2">
				Order settlements
			</Typography>
			<Box className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
				<Box>
					<Typography variant="caption" color="text.secondary">
						Digital collected
					</Typography>
					<Typography fontWeight={600}>{formatGhsCurrency(summary?.digital_collected ?? 0, 2, 2)}</Typography>
				</Box>
				<Box>
					<Typography variant="caption" color="text.secondary">
						Paid out
					</Typography>
					<Typography fontWeight={600} color="success.main">
						{formatGhsCurrency(summary?.settled_paid ?? 0, 2, 2)}
					</Typography>
				</Box>
				<Box>
					<Typography variant="caption" color="text.secondary">
						Pending
					</Typography>
					<Typography fontWeight={600} color="warning.main">
						{formatGhsCurrency(summary?.pending_settlements ?? 0, 2, 2)}
					</Typography>
				</Box>
				<Box>
					<Typography variant="caption" color="text.secondary">
						Available
					</Typography>
					<Typography fontWeight={600} color="primary.main">
						{formatGhsCurrency(summary?.available_balance ?? 0, 2, 2)}
					</Typography>
				</Box>
			</Box>

			<Box className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-divider p-3">
				<TextField size="small" label="Manual payout (GHS)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} sx={{ minWidth: 140 }} />
				<TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: 1, minWidth: 160 }} />
				<Button variant="contained" onClick={onCreate} disabled={creating || !amount}>
					Create settlement
				</Button>
			</Box>

			{rows.length === 0 ? (
				<Typography variant="body2" color="text.secondary">
					No settlements for this tenant.
				</Typography>
			) : (
				<Box className="space-y-2">
					{rows.map((row: any) => {
						const status = String(row.status || '').toLowerCase();
						const isRequested = status === 'requested';
						const isPending = status === 'pending';
						const isPaid = status === 'paid';
						return (
							<Box key={row.id} className="rounded-lg border border-divider p-2">
								<Box className="flex flex-wrap items-start justify-between gap-2">
									<Box>
										<Typography fontWeight={600}>{formatGhsCurrency(Number(row.amount || 0), 2, 2)}</Typography>
										<Typography variant="caption" color="text.secondary">
											{formatDate(row.created_at ?? undefined)}
											{row.source === 'merchant' ? ' · Merchant request' : ' · Admin'}
										</Typography>
										{row.payout_snapshot ? (
											<Typography variant="caption" display="block" color="text.secondary">
												Pay to: {formatPayoutSnapshot(row.payout_snapshot)}
											</Typography>
										) : null}
										{row.rejection_reason ? (
											<Typography variant="caption" display="block" color="error.main">
												Rejected: {row.rejection_reason}
											</Typography>
										) : null}
									</Box>
									<Chip size="small" label={settlementStatusLabel(status)} color={settlementStatusColor(status)} variant={isPaid ? 'filled' : 'outlined'} />
								</Box>
								{isRequested ? (
									<Box className="mt-2 flex flex-wrap items-center gap-2">
										<TextField
											size="small"
											placeholder="Rejection reason"
											value={rejectReasonById[row.id] ?? ''}
											onChange={(e) => setRejectReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
											sx={{ flex: 1, minWidth: 160 }}
										/>
										<Button size="small" variant="contained" onClick={() => onApprove(row.id)} disabled={approving}>
											Approve
										</Button>
										<Button size="small" color="error" variant="outlined" onClick={() => onReject(row.id)} disabled={rejecting}>
											Reject
										</Button>
									</Box>
								) : null}
								{isPending ? (
									<Box className="mt-2 flex flex-wrap items-center gap-2">
										<TextField
											size="small"
											placeholder="Payout ref"
											value={payoutRefById[row.id] ?? ''}
											onChange={(e) => setPayoutRefById((prev) => ({ ...prev, [row.id]: e.target.value }))}
											sx={{ width: 160 }}
										/>
										<Button size="small" variant="outlined" onClick={() => onMarkPaid(row.id)} disabled={markingPaid}>
											Mark paid
										</Button>
									</Box>
								) : null}
							</Box>
						);
					})}
				</Box>
			)}
		</Box>
	);
}
