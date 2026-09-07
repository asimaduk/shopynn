'use client';

import { useMemo, useState } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { MenuItem, ListItemIcon } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import Typography from '@mui/material/Typography';
import { useGetTenantsDirectoryListQuery } from './TenantsDirectoryApi';
import type { TenantDirectoryRow } from './TenantsDirectoryApi';
import TenantDirectoryDetailDialog from './TenantDirectoryDetailDialog';
import { formatDateShort } from '../merchants/merchantFormatters';
import { formatGhsCurrency } from '../dashboards/analytics/daily-sales/formatGhsCurrency';

function subscriptionStatusDisplay(status: string | null | undefined): { icon: string; color: 'success' | 'warning' | 'error' | 'action' | 'disabled' } {
	const s = (status ?? '').toLowerCase();
	if (s.includes('active') && !s.includes('inact')) return { icon: 'heroicons-outline:check-circle', color: 'success' };
	if (s.includes('trial')) return { icon: 'heroicons-outline:clock', color: 'warning' };
	if (s.includes('cancel')) return { icon: 'heroicons-outline:x-circle', color: 'error' };
	if (s.includes('expir') || s.includes('past')) return { icon: 'heroicons-outline:exclamation-triangle', color: 'warning' };
	if (s.includes('inact') || s.includes('suspend')) return { icon: 'heroicons-outline:pause-circle', color: 'disabled' };
	return { icon: 'heroicons-outline:minus-circle', color: 'action' };
}

function isSubscriptionActiveStatus(status: string | null | undefined): boolean {
	const s = (status ?? '').toLowerCase();
	return s.includes('active') && !s.includes('inact');
}

function computeDirectoryStats(rows: TenantDirectoryRow[]) {
	let totalUsers = 0;
	let totalStores = 0;
	let activeSubscriptions = 0;
	let merchantLinked = 0;
	let withPlan = 0;

	for (const r of rows) {
		totalUsers += r.user_count ?? 0;
		totalStores += r.warehouse_count ?? 0;
		if (isSubscriptionActiveStatus(r.subscription_status)) activeSubscriptions += 1;
		if ((r.merchant_count ?? 0) > 0) merchantLinked += 1;
		if (r.subscription_id || (r.subscription_name && r.subscription_name.trim() !== '')) withPlan += 1;
	}

	return {
		totalBusinesses: rows.length,
		activeSubscriptions,
		withPlan,
		totalUsers,
		totalStores,
		merchantLinked
	};
}

type StatCardProps = {
	label: string;
	value: string | number;
	icon: string;
	iconColor: 'primary' | 'success' | 'info' | 'warning' | 'secondary';
	loading?: boolean;
};

function StatCard({ label, value, icon, iconColor, loading }: StatCardProps) {
	return (
		<Paper
			elevation={0}
			className="h-full"
			sx={{
				border: 1,
				borderColor: 'divider',
				borderRadius: 2,
				p: 2
			}}
		>
			<Box className="flex items-start gap-3">
				<Box
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
					sx={{ bgcolor: 'action.hover' }}
				>
					<FuseSvgIcon size={22} color={iconColor}>
						{icon}
					</FuseSvgIcon>
				</Box>
				<Box className="min-w-0 flex-1">
					<Typography
						variant="caption"
						color="text.secondary"
						className="block font-medium uppercase tracking-wide"
					>
						{label}
					</Typography>
					{loading ? (
						<Skeleton variant="text" width={56} height={34} className="mt-0.5" />
					) : (
						<Typography variant="h5" className="mt-0.5 truncate font-semibold tabular-nums leading-tight">
							{value}
						</Typography>
					)}
				</Box>
			</Box>
		</Paper>
	);
}

export default function TenantsDirectoryPage() {
	const [detailId, setDetailId] = useState<string | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);

	const { data, isLoading, isError } = useGetTenantsDirectoryListQuery(undefined, {
		refetchOnMountOrArgChange: true
	});
	const rows = data?.tenants ?? [];
	const stats = useMemo(() => computeDirectoryStats(rows), [rows]);
	const statsLoading = isLoading && !isError;

	const handleView = (row: TenantDirectoryRow) => {
		setDetailId(row.id);
		setDetailOpen(true);
	};

	const columns = useMemo<MRT_ColumnDef<TenantDirectoryRow>[]>(
		() => [
			{
				accessorKey: 'subscription_status',
				header: 'Status',
				size: 120,
				enableColumnFilter: false,
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				Header: () => (
					<span className="flex items-center gap-1.5">
						<FuseSvgIcon size={18} color="action">
							heroicons-outline:signal
						</FuseSvgIcon>
						Status
					</span>
				),
				accessorFn: (row) => row.subscription_status ?? '—',
				Cell: ({ row }) => {
					const label = row.original.subscription_status ?? '—';
					const { icon, color } = subscriptionStatusDisplay(row.original.subscription_status);
					return (
						<span className="flex items-center gap-1.5 min-w-0">
							<FuseSvgIcon className="shrink-0" size={18} color={color}>
								{icon}
							</FuseSvgIcon>
							<span className="truncate">{label}</span>
						</span>
					);
				}
			},
			{
				accessorKey: 'name',
				header: 'Business',
				enableColumnFilter: false,
				accessorFn: (row) => row.name ?? '—',
				Cell: ({ row }) => <span className="font-medium">{row.original.name ?? '—'}</span>
			},
			// {
			// 	accessorKey: 'organization',
			// 	header: 'Organization',
			// 	accessorFn: (row) => row.organization ?? '—'
			// },
			{
				accessorKey: 'phone',
				header: 'Phone',
				size: 120,
				accessorFn: (row) => row.phone ?? '—'
			},
			{
				accessorKey: 'email',
				header: 'Email',
				accessorFn: (row) => row.email ?? '—'
			},
			{
				accessorKey: 'subscription_name',
				header: 'Plan',
				size: 110,
				accessorFn: (row) => row.subscription_name ?? '—'
			},
			{
				accessorKey: 'subscription_amount',
				header: 'Amount',
				size: 90,
				accessorFn: (row) => {
					const raw = row.subscription_amount;
					if (raw == null || raw === '') return '—';
					return formatGhsCurrency(Number(raw), 2, 2);
				}
			},
			{
				accessorKey: 'user_count',
				header: 'Users',
				size: 72,
				accessorFn: (row) => row.user_count ?? 0
			},
			{
				accessorKey: 'warehouse_count',
				header: 'Stores',
				size: 80,
				accessorFn: (row) => row.warehouse_count ?? 0
			},
			{
				accessorKey: 'merchant_count',
				header: 'Merchant users',
				size: 96,
				accessorFn: (row) => row.merchant_count ?? 0,
				Cell: ({ row }) => {
					const n = row.original.merchant_count ?? 0;
					return (
						<span className="inline-flex items-center gap-1 tabular-nums">
							{n > 0 ? (
								<FuseSvgIcon className="shrink-0" size={16} color="primary">
									heroicons-outline:link
								</FuseSvgIcon>
							) : null}
							{n}
						</span>
					);
				}
			},
			{
				accessorKey: 'subscription_end_at',
				header: 'Renews / ends',
				size: 120,
				accessorFn: (row) => (row.subscription_end_at ? formatDateShort(row.subscription_end_at) : '—')
			},
			{
				accessorKey: 'created_at',
				header: 'Created',
				size: 110,
				accessorFn: (row) => (row.created_at ? formatDateShort(row.created_at) : '—')
			}
		],
		[]
	);

	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			<div className="flex h-full w-full flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
				<PageBreadcrumb className="mb-4" />
				<Typography className="text-3xl font-bold tracking-tight mb-1">Tenant directory</Typography>
				<Typography color="text.secondary" className="mb-6 max-w-2xl">
					All businesses on the platform: contact, subscription, and usage counts. Open a row for payments
					and full subscription detail.
				</Typography>

				{!isError && (
					<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
						<StatCard
							label="Businesses"
							value={stats.totalBusinesses}
							icon="heroicons-outline:building-office-2"
							iconColor="primary"
							loading={statsLoading}
						/>
						<StatCard
							label="Active plans"
							value={stats.activeSubscriptions}
							icon="heroicons-outline:check-circle"
							iconColor="success"
							loading={statsLoading}
						/>
						<StatCard
							label="With subscription"
							value={stats.withPlan}
							icon="heroicons-outline:rectangle-stack"
							iconColor="info"
							loading={statsLoading}
						/>
						<StatCard
							label="Users (all)"
							value={stats.totalUsers}
							icon="heroicons-outline:users"
							iconColor="secondary"
							loading={statsLoading}
						/>
						<StatCard
							label="Stores (all)"
							value={stats.totalStores}
							icon="heroicons-outline:building-storefront"
							iconColor="warning"
							loading={statsLoading}
						/>
						<StatCard
							label="Tenants w/ merchant users"
							value={stats.merchantLinked}
							icon="heroicons-outline:link"
							iconColor="primary"
							loading={statsLoading}
						/>
					</div>
				)}

				{isError ? (
					<Typography color="error">Could not load tenants. Check that you have the tenants.directory.view permission.</Typography>
				) : (
					<Paper
						className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full min-h-[400px]"
						elevation={0}
					>
						<DataTable
							data={rows}
							columns={columns}
							initialState={{
								density: 'compact',
								showColumnFilters: false,
								showGlobalFilter: true
							}}
							state={{ isLoading }}
							enableRowSelection={false}
							enableRowActions
							renderRowActionMenuItems={({ row, closeMenu }) => [
								<MenuItem
									key="view"
									onClick={() => {
										closeMenu();
										handleView(row.original);
									}}
								>
									<ListItemIcon>
										<FuseSvgIcon size={20}>heroicons-outline:eye</FuseSvgIcon>
									</ListItemIcon>
									View details
								</MenuItem>
							]}
						/>
					</Paper>
				)}
			</div>

			<TenantDirectoryDetailDialog
				open={detailOpen}
				tenantId={detailId}
				onClose={() => {
					setDetailOpen(false);
					setDetailId(null);
				}}
			/>
		</>
	);
}
