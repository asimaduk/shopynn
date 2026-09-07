'use client';

import { useEffect } from 'react';
import useNavigate from '@fuse/hooks/useNavigate';
import useUser from '@auth/useUser';
import FuseLoading from '@fuse/core/FuseLoading';
import { canManageSubscription } from '@auth/permissions';
import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import { useGetSubscriptionBillingPaymentsQuery } from '../../../billing/SubscriptionApi';

function methodLabel(m?: string) {
	if (!m) return '—';
	return String(m).toLowerCase().includes('mobile') ? 'Mobile money' : 'Card';
}

function statusColor(s?: string) {
	switch (s) {
		case 'completed':
		case 'success':
			return 'success';
		case 'pending':
			return 'warning';
		case 'failed':
		case 'error':
			return 'error';
		default:
			return 'default';
	}
}

export default function ProfilePaymentHistoryPage() {
	const navigate = useNavigate();
	const { data: user, subscriptionExpired } = useUser();
	const { data: payments, isLoading } = useGetSubscriptionBillingPaymentsQuery();

	const canViewBilling = canManageSubscription(user, { allowWhenSubscriptionExpired: subscriptionExpired });

	useEffect(() => {
		if (user != null && !canViewBilling) {
			navigate('/apps/profile');
		}
	}, [user, canViewBilling, navigate]);

	if (user == null) return <FuseLoading />;
	if (!canViewBilling) return <FuseLoading />;

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="flex min-h-full w-full flex-col px-4 py-6">
				<Box className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<Box className="flex items-center gap-3">
						<Box
							className="flex shrink-0 items-center justify-center rounded-xl"
							sx={{ width: 48, height: 48, bgcolor: 'primary.main', color: 'primary.contrastText' }}
						>
							<FuseSvgIcon size={26}>heroicons-outline:clock</FuseSvgIcon>
						</Box>
						<div>
							<Typography variant="h5" fontWeight="bold">
								Billing payment history
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Subscription plan payments for your business
							</Typography>
						</div>
					</Box>
					<Button
						component={NavLinkAdapter}
						to="/apps/profile"
						variant="outlined"
						size="small"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to profile
					</Button>
				</Box>

				<Box className="mx-auto w-full max-w-4xl">
					<Paper variant="outlined" className="overflow-hidden rounded-xl" sx={{ borderColor: 'divider' }}>
						<Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
						<Table size="medium" sx={{ minWidth: 560 }}>
							<TableHead>
								<TableRow>
									<TableCell>Date</TableCell>
									<TableCell>Amount</TableCell>
									<TableCell>Method</TableCell>
									<TableCell>Status</TableCell>
									<TableCell>Reference</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell colSpan={5}>
											<FuseLoading />
										</TableCell>
									</TableRow>
								) : (payments || []).length === 0 ? (
									<TableRow>
										<TableCell colSpan={5}>
											<Typography variant="body2" color="text.secondary" className="py-4 text-center">
												No billing payments yet.
											</Typography>
										</TableCell>
									</TableRow>
								) : (
									(payments || []).map((row) => (
										<TableRow key={row.id || row.transaction_ref}>
											<TableCell>
												{row.created_at
													? new Date(row.created_at).toLocaleString('en-US', {
															month: 'short',
															day: 'numeric',
															year: 'numeric',
															hour: 'numeric',
															minute: '2-digit'
														})
													: '—'}
											</TableCell>
											<TableCell>
												{row.currency || 'GHS'} {Number(row.amount || 0).toFixed(2)}
											</TableCell>
											<TableCell>{methodLabel(row.payment_method || row.payment_method_type)}</TableCell>
											<TableCell>
												<Chip
													size="small"
													label={row.status || '—'}
													color={statusColor(row.status)}
													variant="outlined"
												/>
											</TableCell>
											<TableCell>{row.transaction_ref ?? row.reference ?? '—'}</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
						</Box>
					</Paper>
				</Box>
			</div>
		</>
	);
}
