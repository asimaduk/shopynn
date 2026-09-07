'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@fuse/core/Link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import FuseLoading from '@fuse/core/FuseLoading';
import useUser from '@auth/useUser';
import { hasPermissionCodes } from '@auth/permissions';
import toast from 'react-hot-toast';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import type { AdminMerchantRow } from './MerchantApi';
import {
	useGetMerchantMeQuery,
	useGetOnboardedTenantsQuery,
	useGetMerchantCommissionsQuery,
	useGetAdminMerchantsQuery,
	useRevokeMerchantMutation
} from './MerchantApi';
import MerchantsHeader from './MerchantsHeader';
import MerchantsTable from './MerchantsTable';
import MerchantPromoteDialog from './MerchantPromoteDialog';
import RevokeMerchantConfirmDialog from './RevokeMerchantConfirmDialog';
import { formatDate, formatMoney, userDisplayName } from './merchantFormatters';

export default function MerchantsPage() {
	const router = useRouter();
	const { data: user } = useUser();
	const canManageMerchants = hasPermissionCodes(user, 'merchants.view');
	const canOperateMerchantPortal = hasPermissionCodes(user, ['merchants.operate', 'merchants.view']);

	const { data: meData, isLoading: loadingMe } = useGetMerchantMeQuery(undefined, {
		refetchOnMountOrArgChange: true
	});
	const merchant = meData?.merchant ?? null;

	const { data: adminMerchantsData, isLoading: loadingAdminMerchants } = useGetAdminMerchantsQuery(
		undefined,
		{ skip: !canManageMerchants, refetchOnMountOrArgChange: true }
	);
	const adminMerchants = adminMerchantsData?.merchants ?? [];

	const onboardedBusinessTotal = useMemo(
		() => adminMerchants.reduce((s, m) => s + (Number(m.onboarded_count) || 0), 0),
		[adminMerchants]
	);

	const skipLists = !merchant?.id || !canOperateMerchantPortal;
	const { data: tenantsData, isLoading: loadingTenants } = useGetOnboardedTenantsQuery(undefined, {
		skip: skipLists,
		refetchOnMountOrArgChange: true
	});
	const { data: commissionsData, isLoading: loadingCommissions } = useGetMerchantCommissionsQuery(
		undefined,
		{ skip: skipLists, refetchOnMountOrArgChange: true }
	);

	const [tab, setTab] = useState(0);
	const [promoteOpen, setPromoteOpen] = useState(false);
	const [revokeTarget, setRevokeTarget] = useState<AdminMerchantRow | null>(null);

	const [revokeMerchant, { isLoading: revoking }] = useRevokeMerchantMutation();

	const tenants = tenantsData?.tenants ?? [];
	const commissions = commissionsData?.commissions ?? [];

	const handleViewMerchantDetails = (row: AdminMerchantRow) => {
		router.push(`/merchants/${row.id}`);
	};

	const handleRevokeMerchantRequest = (row: AdminMerchantRow) => {
		setRevokeTarget(row);
	};

	const handleRevokeMerchantConfirm = async () => {
		if (!revokeTarget) return;
		try {
			await revokeMerchant(revokeTarget.id).unwrap();
			toast.success('User is no longer a merchant.');
			setRevokeTarget(null);
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; error?: string };
			toast.error(err?.data?.message || err?.error || 'Could not remove merchant');
		}
	};

	const revokeDialog = (
		<RevokeMerchantConfirmDialog
			open={revokeTarget != null}
			merchantLabel={revokeTarget ? userDisplayName(revokeTarget) : ''}
			loading={revoking}
			onClose={() => setRevokeTarget(null)}
			onConfirm={handleRevokeMerchantConfirm}
		/>
	);

	const loadingPortal = !skipLists && (loadingTenants || loadingCommissions);

	const title = useMemo(() => 'Clients / Users', []);

	if (loadingMe) {
		return (
			<Box className="flex min-h-[320px] items-center justify-center p-8">
				<FuseLoading />
			</Box>
		);
	}

	if (!merchant) {
		if (canManageMerchants) {
			return (
			<>
				{revokeDialog}
				<GlobalStyles
					styles={() => ({
						'#root': {
							maxHeight: '100vh'
						}
					})}
				/>
				<div className="w-full h-full flex flex-col px-4">
					<MerchantsHeader
						merchantUserCount={adminMerchants.length}
						onboardedBusinessTotal={onboardedBusinessTotal}
						isLoading={loadingAdminMerchants}
						showAddMerchant
						onAddMerchant={() => setPromoteOpen(true)}
					/>
					<MerchantsTable
						data={adminMerchants}
						isLoading={loadingAdminMerchants}
						onViewDetails={handleViewMerchantDetails}
						onRevoke={handleRevokeMerchantRequest}
						revoking={revoking}
					/>
					<MerchantPromoteDialog open={promoteOpen} onClose={() => setPromoteOpen(false)} />
				</div>
			</>
			);
		}

		if (canOperateMerchantPortal) {
			return (
				<div className="w-full h-full flex flex-col px-4">
					<div className="py-8">
						<PageBreadcrumb className="mb-2" />
						<Typography className="text-4xl font-extrabold leading-none tracking-tight">
							Merchant portal
						</Typography>
						<Typography color="text.secondary" className="mt-2 max-w-md">
							You have merchant portal permission, but your account is not linked to a merchant record yet.
							Ask an administrator to register you as a merchant partner.
						</Typography>
					</div>
				</div>
			);
		}

		return (
			<div className="w-full h-full flex flex-col px-4">
				<div className="py-8">
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">
						Merchant portal
					</Typography>
					<Typography color="text.secondary" className="mt-2 max-w-md">
						You do not have access to merchant partner tools.
					</Typography>
				</div>
			</div>
		);
	}

	if (!canOperateMerchantPortal) {
		return (
			<div className="w-full h-full flex flex-col px-4">
				<div className="py-8">
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">
						Merchant portal
					</Typography>
					<Typography color="text.secondary" className="mt-2 max-w-md">
						You do not have merchant portal permission (merchants.operate or merchants.view). Ask an
						administrator to assign it to your role.
					</Typography>
				</div>
			</div>
		);
	}

	return (
		<>
			{revokeDialog}
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			<div className="w-full h-full flex flex-col px-4">
				<MerchantsHeader
					merchantUserCount={adminMerchants.length}
					onboardedBusinessTotal={onboardedBusinessTotal}
					isLoading={loadingAdminMerchants && canManageMerchants}
					showOnboardBusiness={!!merchant}
					showAddMerchant={canManageMerchants}
					onAddMerchant={() => setPromoteOpen(true)}
					title={title}
					subtitle={
						loadingPortal ? (
							'…'
						) : (
							<>
								{tenants.length} {tenants.length === 1 ? 'business' : 'businesses'} onboarded
								<span className="mx-2 opacity-50">·</span>
								{commissions.length} commission {commissions.length === 1 ? 'record' : 'records'}
							</>
						)
					}
				/>

				<Paper
					className="flex flex-auto flex-col overflow-hidden rounded-t-lg shadow-1 rounded-b-none"
					elevation={0}
				>
					<Tabs value={tab} onChange={(_, v) => setTab(v)} className="border-b border-divider px-2">
						<Tab label={`Businesses (${tenants.length})`} />
						<Tab label={`Commissions (${commissions.length})`} />
						{canManageMerchants ? <Tab label={`All merchants (${adminMerchants.length})`} /> : null}
					</Tabs>

					{loadingPortal && tab !== 2 ? (
						<Box className="flex min-h-[200px] items-center justify-center p-8">
							<FuseLoading />
						</Box>
					) : tab === 0 ? (
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Name</TableCell>
									<TableCell>Organization</TableCell>
									<TableCell>Phone</TableCell>
									<TableCell>Subscription</TableCell>
									<TableCell>Payment</TableCell>
									<TableCell>Created</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{tenants.map((t) => (
									<TableRow key={t.id} hover>
										<TableCell>{t.name ?? '—'}</TableCell>
										<TableCell>{t.organization ?? '—'}</TableCell>
										<TableCell>{t.phone ?? '—'}</TableCell>
										<TableCell>
											{t.subscription_name ?? '—'}{' '}
											{t.subscription_amount != null ? `(₵${formatMoney(t.subscription_amount)})` : ''}
										</TableCell>
										<TableCell>
											{t.quote_status === 'pending_payment' ? (
												<Button
													component={Link}
													to={`/merchants/collect/${t.id}`}
													size="small"
													variant="contained"
													color="warning"
												>
													Collect ₵{formatMoney(t.quote_total_ghs)}
												</Button>
											) : (
												<Box className="flex flex-wrap gap-1">
													{String(t.subscription_name || '').toLowerCase() === 'free' ? (
														<Button
															component={Link}
															to={`/merchants/upgrade-collect/${t.id}`}
															size="small"
															variant="contained"
															color="primary"
														>
															Upgrade & collect
														</Button>
													) : null}
													<Button
														component={Link}
														to={`/merchants/add-services/${t.id}`}
														size="small"
														variant="outlined"
														color="secondary"
													>
														Add services
													</Button>
												</Box>
											)}
										</TableCell>
										<TableCell>{formatDate(t.created_at)}</TableCell>
									</TableRow>
								))}
								{tenants.length === 0 && (
									<TableRow>
										<TableCell colSpan={6}>
											<Typography color="text.secondary">
												No businesses yet.{' '}
												<Button
													component={Link}
													to="/merchants/onboard"
													size="small"
													variant="text"
													sx={{ verticalAlign: 'baseline', p: 0, minWidth: 0 }}
												>
													Onboard a business
												</Button>
												.
											</Typography>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					) : tab === 1 ? (
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Business</TableCell>
									<TableCell align="right">Base</TableCell>
									<TableCell align="right">%</TableCell>
									<TableCell align="right">Commission</TableCell>
									<TableCell>Status</TableCell>
									<TableCell>Created</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{commissions.map((c) => (
									<TableRow key={c.id} hover>
										<TableCell>{c.tenant_name ?? c.tenant_id}</TableCell>
										<TableCell align="right">₵{formatMoney(c.base_amount)}</TableCell>
										<TableCell align="right">{formatMoney(c.commission_percent)}</TableCell>
										<TableCell align="right">₵{formatMoney(c.commission_amount)}</TableCell>
										<TableCell>
											<Chip
												size="small"
												label={c.status}
												color={c.status === 'paid' ? 'success' : 'warning'}
												variant={c.status === 'paid' ? 'filled' : 'outlined'}
											/>
										</TableCell>
										<TableCell>{formatDate(c.created_at)}</TableCell>
									</TableRow>
								))}
								{commissions.length === 0 && (
									<TableRow>
										<TableCell colSpan={6}>
											<Typography color="text.secondary">No commission rows yet.</Typography>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					) : canManageMerchants ? (
						<div className="flex flex-auto flex-col min-h-[240px]">
							{loadingAdminMerchants ? (
								<Box className="flex min-h-[200px] items-center justify-center p-8">
									<FuseLoading />
								</Box>
							) : (
								<MerchantsTable
									embedded
									data={adminMerchants}
									isLoading={false}
									onViewDetails={handleViewMerchantDetails}
									onRevoke={handleRevokeMerchantRequest}
									revoking={revoking}
								/>
							)}
						</div>
					) : null}
				</Paper>

				<MerchantPromoteDialog open={promoteOpen} onClose={() => setPromoteOpen(false)} />
			</div>
		</>
	);
}
