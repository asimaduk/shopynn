'use client';

import { motion } from 'motion/react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { alpha, useTheme } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import {
	useGetMySettlementSummaryQuery,
	useGetMySettlementsQuery,
	useRetryMyWithdrawalMutation
} from '../../billing/SubscriptionApi';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';
import PayoutProfileSection from './PayoutProfileSection';
import { formatPayoutSnapshot, settlementStatusColor, settlementStatusLabel } from './settlementUtils';

const fmtDate = (raw?: string) => (raw ? new Date(raw).toLocaleString() : '—');

export default function OrderSettlementsPage() {
	const theme = useTheme();
	const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useGetMySettlementSummaryQuery();
	const { data: rows = [], isLoading: rowsLoading, refetch: refetchRows } = useGetMySettlementsQuery();
	const [retryWithdrawal, { isLoading: retrying }] = useRetryMyWithdrawalMutation();
	const isLoading = summaryLoading || rowsLoading;

	const refreshSettlements = () => {
		refetchSummary();
		refetchRows();
	};

	return (
		<PlanFeatureGate requiredFeatures={['payments.view']} requiredPermissions={['payments.view']}>
			<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8">
				<div className="flex grow-0 flex-col justify-between gap-4 py-6 sm:flex-row sm:items-start sm:py-8">
					<motion.span initial={{ x: -20 }} animate={{ x: 0, transition: { delay: 0.2 } }} className="min-w-0 flex-1">
						<PageBreadcrumb className="mb-2" />
						<div className="flex items-start gap-3">
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: 44,
									height: 44,
									borderRadius: 2,
									flexShrink: 0,
									bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.14),
									color: 'primary.main'
								}}
							>
								<FuseSvgIcon size={24}>heroicons-outline:building-library</FuseSvgIcon>
							</Box>
							<div className="min-w-0">
								<Typography component="h1" className="text-4xl font-extrabold leading-none tracking-tight">
									Order settlements
								</Typography>
								<Typography variant="body2" color="text.secondary" className="mt-1">
									Digital order payments collected by Shopynn and payouts to your business.
								</Typography>
							</div>
						</div>
					</motion.span>
					<Button component={NavLinkAdapter} to="/trading/order-payments" variant="outlined" sx={{ textTransform: 'none', fontWeight: 600 }}>
						View order payments
					</Button>
				</div>

				{isLoading ? (
					<FuseLoading />
				) : (
					<>
						<Paper elevation={0} className="mb-6 overflow-hidden shadow-sm" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
							<Box
								sx={{
									display: 'grid',
									gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
									gap: 2,
									p: 2.5
								}}
							>
								<Box>
									<Typography variant="caption" color="text.secondary">
										Digital collected
									</Typography>
									<Typography variant="h6" fontWeight={700}>
										{formatGhsCurrency(summary?.digital_collected ?? 0, 2, 2)}
									</Typography>
								</Box>
								<Box>
									<Typography variant="caption" color="text.secondary">
										Paid out
									</Typography>
									<Typography variant="h6" fontWeight={700} color="success.main">
										{formatGhsCurrency(summary?.settled_paid ?? 0, 2, 2)}
									</Typography>
								</Box>
								<Box>
									<Typography variant="caption" color="text.secondary">
										Pending payout
									</Typography>
									<Typography variant="h6" fontWeight={700} color="warning.main">
										{formatGhsCurrency(summary?.pending_settlements ?? 0, 2, 2)}
									</Typography>
								</Box>
								<Box>
									<Typography variant="caption" color="text.secondary">
										Available balance
									</Typography>
									<Typography variant="h6" fontWeight={700} color="primary.main">
										{formatGhsCurrency(summary?.available_balance ?? 0, 2, 2)}
									</Typography>
								</Box>
							</Box>
							<Divider />
							<Box sx={{ p: 2.5 }}>
								<Typography variant="body2" color="text.secondary">
									Card and mobile-money order payments are collected by Shopynn. Cash collected in-store is not
									included here. Save your payout details and withdraw — funds are sent automatically via Paystack.
								</Typography>
							</Box>
						</Paper>

						<PayoutProfileSection
							availableBalance={summary?.available_balance ?? 0}
							onWithdrawalSubmitted={refreshSettlements}
						/>

						<Paper variant="outlined" className="rounded-xl overflow-hidden" sx={{ borderColor: 'divider' }}>
							<Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
								<Typography fontWeight={700}>Withdrawal & settlement history</Typography>
							</Box>
							{rows.length === 0 ? (
								<Box sx={{ p: 4 }}>
									<Typography color="text.secondary">No withdrawals or settlements yet.</Typography>
								</Box>
							) : (
								<Box>
									{rows.map((row: any) => {
										const status = String(row.status || '').toLowerCase();
										return (
											<Box
												key={row.id}
												sx={{
													px: 2.5,
													py: 2,
													display: 'flex',
													flexWrap: 'wrap',
													gap: 1,
													alignItems: 'center',
													justifyContent: 'space-between',
													borderBottom: 1,
													borderColor: 'divider'
												}}
											>
												<Box>
													<Typography fontWeight={600}>{formatGhsCurrency(Number(row.amount || 0), 2, 2)}</Typography>
													<Typography variant="caption" color="text.secondary">
														{fmtDate(row.created_at)}
														{row.payout_reference ? ` · Ref: ${row.payout_reference}` : ''}
													</Typography>
													{row.payout_snapshot ? (
														<Typography variant="caption" display="block" color="text.secondary">
															To: {formatPayoutSnapshot(row.payout_snapshot)}
														</Typography>
													) : null}
													{row.note ? (
														<Typography variant="caption" display="block" color="text.secondary">
															{row.note}
														</Typography>
													) : null}
													{row.rejection_reason ? (
														<Typography variant="caption" display="block" color="error.main">
															{status === 'rejected' ? 'Rejected: ' : ''}
															{row.rejection_reason}
														</Typography>
													) : null}
													{row.paystack_transfer_reference ? (
														<Typography variant="caption" display="block" color="text.secondary">
															Paystack ref: {row.paystack_transfer_reference}
														</Typography>
													) : null}
												</Box>
												<Box className="flex flex-col items-end gap-1">
													<Chip
														size="small"
														label={settlementStatusLabel(status)}
														color={settlementStatusColor(status)}
														variant={status === 'paid' ? 'filled' : 'outlined'}
													/>
													{status === 'failed' && row.source === 'merchant' ? (
														<Button
															size="small"
															variant="outlined"
															disabled={retrying}
															onClick={async () => {
																try {
																	await retryWithdrawal(row.id).unwrap();
																	refreshSettlements();
																} catch (_) {
																	/* shown via api error toast if configured */
																}
															}}
														>
															Retry payout
														</Button>
													) : null}
												</Box>
											</Box>
										);
									})}
								</Box>
							)}
						</Paper>
					</>
				)}
			</Box>
		</PlanFeatureGate>
	);
}
