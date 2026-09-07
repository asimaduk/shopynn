'use client';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetTenantDirectoryDetailQuery } from './TenantsDirectoryApi';
import { formatDate } from '../merchants/merchantFormatters';
import { formatGhsCurrency } from '../dashboards/analytics/daily-sales/formatGhsCurrency';
import AdminTenantSettlementsPanel from './AdminTenantSettlementsPanel';

type TenantDirectoryDetailDialogProps = {
	open: boolean;
	onClose: () => void;
	tenantId: string | null;
};

export default function TenantDirectoryDetailDialog({
	open,
	onClose,
	tenantId
}: TenantDirectoryDetailDialogProps) {
	const { data, isFetching, isError } = useGetTenantDirectoryDetailQuery(tenantId!, {
		skip: !open || !tenantId
	});

	const tenant = data?.tenant as Record<string, unknown> | undefined;
	const subscription = data?.subscription ?? null;
	const payments = data?.recentPayments ?? [];

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
			<DialogTitle>Tenant details</DialogTitle>
			<DialogContent dividers className="flex flex-col gap-4">
				{isFetching ? (
					<div className="flex min-h-[160px] items-center justify-center py-8">
						<FuseLoading />
					</div>
				) : isError || !tenant ? (
					<Typography color="text.secondary">Could not load tenant.</Typography>
				) : (
					<>
						<Box>
							<Typography variant="subtitle2" color="text.secondary" gutterBottom>
								Business
							</Typography>
							<Typography fontWeight={600}>{String(tenant.name ?? '—')}</Typography>
							<Typography variant="body2" color="text.secondary">
								{String(tenant.organization ?? '—')}
							</Typography>
						</Box>
						<Box className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<Typography variant="body2">
								<strong>Phone:</strong> {String(tenant.phone ?? '—')}
							</Typography>
							<Typography variant="body2">
								<strong>Email:</strong> {String(tenant.email ?? '—')}
							</Typography>
							<Typography variant="body2">
								<strong>Location:</strong>{' '}
								{[tenant.city, tenant.state, tenant.country].filter(Boolean).join(', ') || '—'}
							</Typography>
							<Typography variant="body2">
								<strong>Address:</strong> {String(tenant.address ?? '—')}
							</Typography>
							<Typography variant="body2">
								<strong>Industry:</strong> {String(tenant.industry_name ?? '—')}
							</Typography>
							<Typography variant="body2">
								<strong>Created:</strong> {formatDate(String(tenant.created_at ?? '') || undefined)}
							</Typography>
						</Box>
						<Box className="flex flex-wrap gap-2">
							<Chip size="small" label={`Users: ${tenant.user_count ?? 0}`} variant="outlined" />
							<Chip size="small" label={`Warehouses: ${tenant.warehouse_count ?? 0}`} variant="outlined" />
							<Chip
								size="small"
								variant="outlined"
								color={Number(tenant.merchant_count ?? 0) > 0 ? 'primary' : 'default'}
								label={`Merchant users: ${Number(tenant.merchant_count ?? 0)}`}
							/>
						</Box>
						<Box>
							<Typography variant="subtitle1" fontWeight={700} className="mb-2">
								Subscription
							</Typography>
							{!subscription ? (
								<Typography variant="body2" color="text.secondary">
									No subscription on file.
								</Typography>
							) : (
								<Box className="rounded-lg border border-divider p-3 space-y-1">
									<Typography fontWeight={600}>{subscription.name ?? '—'}</Typography>
									<Typography variant="body2" color="text.secondary">
										Status:{' '}
										<Chip component="span" size="small" label={subscription.status ?? '—'} sx={{ verticalAlign: 'middle', ml: 0.5 }} />
									</Typography>
									<Typography variant="body2">
										Amount: {formatGhsCurrency(Number(subscription.amount ?? 0), 2, 2)} ·{' '}
										{subscription.billing_interval ?? '—'}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{formatDate(subscription.start_at ?? undefined)} → {formatDate(subscription.end_at ?? undefined)}
									</Typography>
								</Box>
							)}
						</Box>
						<Box>
							<Typography variant="subtitle1" fontWeight={700} className="mb-2">
								Recent payments ({payments.length})
							</Typography>
							{payments.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									No payments recorded.
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>Date</TableCell>
											<TableCell align="right">Amount</TableCell>
											<TableCell>Method</TableCell>
											<TableCell>Status</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{payments.map((p) => (
											<TableRow key={p.id}>
												<TableCell>{formatDate(p.created_at ?? undefined)}</TableCell>
												<TableCell align="right">
													{p.amount != null ? formatGhsCurrency(Number(p.amount), 2, 2) : '—'}
												</TableCell>
												<TableCell>{p.payment_method_type ?? '—'}</TableCell>
												<TableCell>{p.status ?? '—'}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</Box>
						{tenantId ? <AdminTenantSettlementsPanel tenantId={tenantId} /> : null}
					</>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
}
