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
import Alert from '@mui/material/Alert';
import type { AdminMerchantRow } from './MerchantApi';
import {
	useGetMerchantMeQuery,
	useGetOnboardedTenantsQuery,
	useGetMerchantCommissionsQuery,
	useGetAdminMerchantsQuery,
	useDeactivateMerchantMutation,
	useReactivateMerchantMutation,
	useApproveRecruitMutation,
	useRejectRecruitMutation
} from './MerchantApi';
import MerchantsHeader from './MerchantsHeader';
import MerchantsTable, { type MerchantRowAction } from './MerchantsTable';
import MerchantPromoteDialog from './MerchantPromoteDialog';
import DeactivateAgentDialog from './DeactivateAgentDialog';
import AgentTeamDialog from './AgentTeamDialog';
import MerchantTeamPanel from './MerchantTeamPanel';
import AgentEarningsPanel from './AgentEarningsPanel';
import AgentPayoutsPanel from './AgentPayoutsPanel';
import CommissionStatusChip from './CommissionStatusChip';
import {
	AGENT_STATUS_LABEL,
	commissionKindLabel,
	formatDate,
	formatMoney,
	managerDisplayName,
	userDisplayName
} from './merchantFormatters';

type PortalTab = 'businesses' | 'commissions' | 'earnings' | 'team' | 'team_shops' | 'all' | 'payouts';

function errorMessage(e: unknown, fallback: string) {
	const err = e as { data?: { message?: string }; error?: string };
	return err?.data?.message || err?.error || fallback;
}

export default function MerchantsPage() {
	const router = useRouter();
	const { data: user } = useUser();
	const canManageMerchants = hasPermissionCodes(user, 'merchants.view');
	const canOperateMerchantPortal = hasPermissionCodes(user, ['merchants.operate', 'merchants.view']);
	const canApprovePayouts = hasPermissionCodes(user, 'merchants.payouts.approve');

	const { data: meData, isLoading: loadingMe } = useGetMerchantMeQuery(undefined, {
		refetchOnMountOrArgChange: true
	});
	const merchant = meData?.merchant ?? null;
	const merchantActive = merchant?.status == null || merchant.status === 'active';
	const isManager = merchant?.agent_type === 'manager' && merchantActive;

	const { data: adminMerchantsData, isLoading: loadingAdminMerchants } = useGetAdminMerchantsQuery(
		undefined,
		{ skip: !canManageMerchants, refetchOnMountOrArgChange: true }
	);
	const adminMerchants = adminMerchantsData?.merchants ?? [];
	const pendingRecruits = adminMerchants.filter((m) => m.status === 'pending_approval');

	const onboardedBusinessTotal = useMemo(
		() => adminMerchants.reduce((s, m) => s + (Number(m.serving_count) || 0), 0),
		[adminMerchants]
	);

	const skipLists = !merchant?.id || !canOperateMerchantPortal;
	const { data: tenantsData, isLoading: loadingTenants } = useGetOnboardedTenantsQuery(undefined, {
		skip: skipLists || !merchantActive,
		refetchOnMountOrArgChange: true
	});
	const { data: commissionsData, isLoading: loadingCommissions } = useGetMerchantCommissionsQuery(
		undefined,
		{ skip: skipLists, refetchOnMountOrArgChange: true }
	);

	const [tab, setTab] = useState<PortalTab>('businesses');
	const [adminTab, setAdminTab] = useState<'agents' | 'payouts'>('agents');
	const [promoteOpen, setPromoteOpen] = useState(false);
	const [deactivateTarget, setDeactivateTarget] = useState<AdminMerchantRow | null>(null);
	const [teamTarget, setTeamTarget] = useState<AdminMerchantRow | null>(null);

	const [deactivateMerchant, { isLoading: deactivating }] = useDeactivateMerchantMutation();
	const [reactivateMerchant, { isLoading: reactivating }] = useReactivateMerchantMutation();
	const [approveRecruit, { isLoading: approving }] = useApproveRecruitMutation();
	const [rejectRecruit, { isLoading: rejecting }] = useRejectRecruitMutation();
	const adminBusy = deactivating || reactivating || approving || rejecting;

	const tenants = tenantsData?.tenants ?? [];
	const commissions = commissionsData?.commissions ?? [];

	const handleAdminAction = async (action: MerchantRowAction, row: AdminMerchantRow) => {
		const name = userDisplayName(row);
		try {
			if (action === 'view') {
				router.push(`/merchants/${row.id}`);
			} else if (action === 'team') {
				setTeamTarget(row);
			} else if (action === 'deactivate') {
				setDeactivateTarget(row);
			} else if (action === 'approve') {
				await approveRecruit(row.id).unwrap();
				toast.success(`${name} approved. Their login was emailed to ${row.email ?? 'them'}.`);
			} else if (action === 'reject') {
				if (!window.confirm(`Reject ${name}? They will not get a login.`)) return;
				await rejectRecruit({ merchantId: row.id }).unwrap();
				toast.success(`${name} rejected.`);
			} else if (action === 'reactivate') {
				await reactivateMerchant(row.id).unwrap();
				toast.success(`${name} reactivated. Shops that were handed over stay with their new agent.`);
			}
		} catch (e) {
			toast.error(errorMessage(e, 'Action failed'));
		}
	};

	const handleDeactivateConfirm = async (reason: string) => {
		if (!deactivateTarget) return;
		try {
			const res = await deactivateMerchant({ merchantId: deactivateTarget.id, reason }).unwrap();
			toast.success(`Agent deactivated. ${res.shops_moved} shop(s) handed over.`);
			setDeactivateTarget(null);
		} catch (e) {
			toast.error(errorMessage(e, 'Could not deactivate agent'));
		}
	};

	const deactivateHeir =
		deactivateTarget?.manager_id &&
		adminMerchants.some((m) => m.id === deactivateTarget.manager_id && m.status === 'active')
			? managerDisplayName(deactivateTarget)
			: null;

	const adminDialogs = canManageMerchants ? (
		<>
			<DeactivateAgentDialog
				open={deactivateTarget != null}
				agentLabel={deactivateTarget ? userDisplayName(deactivateTarget) : ''}
				handOverTo={deactivateHeir}
				isManager={deactivateTarget?.agent_type === 'manager'}
				loading={deactivating}
				onClose={() => setDeactivateTarget(null)}
				onConfirm={handleDeactivateConfirm}
			/>
			<AgentTeamDialog agent={teamTarget} allAgents={adminMerchants} onClose={() => setTeamTarget(null)} />
		</>
	) : null;

	const pendingBanner =
		canManageMerchants && pendingRecruits.length > 0 ? (
			<Alert severity="warning" className="mb-3">
				{pendingRecruits.length} recruit{pendingRecruits.length === 1 ? '' : 's'} awaiting approval:{' '}
				{pendingRecruits
					.map((m) => `${userDisplayName(m)}${m.manager_first_name ? ` (by ${managerDisplayName(m)})` : ''}`)
					.join(', ')}
				. Use the row menu to approve or reject.
			</Alert>
		) : null;

	const loadingPortal = !skipLists && ((merchantActive && loadingTenants) || loadingCommissions);

	const title = useMemo(() => 'Clients / Shops', []);

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
				{adminDialogs}
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
					{pendingBanner}
					{canApprovePayouts ? (
						<Tabs value={adminTab} onChange={(_, v) => setAdminTab(v)} className="mb-2">
							<Tab value="agents" label={`Agents (${adminMerchants.length})`} />
							<Tab value="payouts" label="Payouts" />
						</Tabs>
					) : null}
					{adminTab === 'payouts' && canApprovePayouts ? (
						<Paper className="flex flex-auto flex-col overflow-auto rounded-t-lg shadow-1 rounded-b-none" elevation={0}>
							<AgentPayoutsPanel />
						</Paper>
					) : (
						<MerchantsTable
							data={adminMerchants}
							isLoading={loadingAdminMerchants}
							onAction={handleAdminAction}
							busy={adminBusy}
						/>
					)}
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
							Agents
						</Typography>
						<Typography color="text.secondary" className="mt-2 max-w-md">
							You have agent permissions, but your account is not linked to an agent record yet.
							Ask an administrator to register you as an agent.
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
						Agents
					</Typography>
					<Typography color="text.secondary" className="mt-2 max-w-md">
						You do not have access to agent tools.
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
						Agents
					</Typography>
					<Typography color="text.secondary" className="mt-2 max-w-md">
						You do not have merchant portal permission (merchants.operate or merchants.view). Ask an
						administrator to assign it to your role.
					</Typography>
				</div>
			</div>
		);
	}

	const effectiveTab: PortalTab = !merchantActive && tab === 'businesses' ? 'commissions' : tab;

	return (
		<>
			{adminDialogs}
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
					showOnboardBusiness={!!merchant && merchantActive}
					showAddMerchant={canManageMerchants}
					onAddMerchant={() => setPromoteOpen(true)}
					title={title}
					subtitle={
						loadingPortal ? (
							'…'
						) : (
							<>
								{tenants.length} {tenants.length === 1 ? 'business' : 'businesses'}
								<span className="mx-2 opacity-50">·</span>
								{commissions.length} commission {commissions.length === 1 ? 'record' : 'records'}
							</>
						)
					}
				/>

				{!merchantActive && merchant?.status ? (
					<Alert severity="info" className="mb-3">
						Your agent account is {AGENT_STATUS_LABEL[merchant.status].toLowerCase()}. You can still see
						the commission you have earned.
					</Alert>
				) : null}
				{pendingBanner}

				<Paper
					className="flex flex-auto flex-col overflow-hidden rounded-t-lg shadow-1 rounded-b-none"
					elevation={0}
				>
					<Tabs value={effectiveTab} onChange={(_, v) => setTab(v)} className="border-b border-divider px-2">
						{merchantActive ? <Tab value="businesses" label={`Businesses (${tenants.length})`} /> : null}
						<Tab value="commissions" label={`Commissions (${commissions.length})`} />
						<Tab value="earnings" label="Earnings" />
						{isManager ? <Tab value="team" label="My team" /> : null}
						{isManager ? <Tab value="team_shops" label="Team shops" /> : null}
						{canManageMerchants ? <Tab value="all" label={`All agents (${adminMerchants.length})`} /> : null}
						{canApprovePayouts ? <Tab value="payouts" label="Payouts" /> : null}
					</Tabs>

					{effectiveTab === 'earnings' ? (
						<AgentEarningsPanel />
					) : effectiveTab === 'payouts' ? (
						<AgentPayoutsPanel />
					) : effectiveTab === 'team' || effectiveTab === 'team_shops' ? (
						merchant ? (
							<MerchantTeamPanel
								manager={merchant}
								managerName={user?.displayName || 'You'}
								view={effectiveTab === 'team' ? 'members' : 'shops'}
							/>
						) : null
					) : loadingPortal && effectiveTab !== 'all' ? (
						<Box className="flex min-h-[200px] items-center justify-center p-8">
							<FuseLoading />
						</Box>
					) : effectiveTab === 'businesses' ? (
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
										<TableCell>
											{t.name ?? '—'}
											{t.awaiting_first_payment ? (
												<Chip
													size="small"
													label="Awaiting first payment"
													color="warning"
													variant="outlined"
													className="ml-2"
												/>
											) : null}
										</TableCell>
										<TableCell>{t.organization ?? '—'}</TableCell>
										<TableCell>{t.phone ?? '—'}</TableCell>
										<TableCell>
											{t.subscription_name ?? '—'}{' '}
											{t.subscription_amount != null ? `(GHS ${formatMoney(t.subscription_amount)})` : ''}
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
													Collect GHS {formatMoney(t.quote_total_ghs)}
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
					) : effectiveTab === 'commissions' ? (
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Business</TableCell>
									<TableCell>Type</TableCell>
									<TableCell align="right">Base</TableCell>
									<TableCell align="right">Commission</TableCell>
									<TableCell>Status</TableCell>
									<TableCell>Created</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{commissions.map((c) => (
									<TableRow key={c.id} hover>
										<TableCell>{c.tenant_name ?? c.tenant_id}</TableCell>
										<TableCell>{commissionKindLabel(c)}</TableCell>
										<TableCell align="right">GHS {formatMoney(c.base_amount)}</TableCell>
										<TableCell align="right">GHS {formatMoney(c.commission_amount)}</TableCell>
										<TableCell>
											<CommissionStatusChip commission={c} />
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
									onAction={handleAdminAction}
									busy={adminBusy}
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
