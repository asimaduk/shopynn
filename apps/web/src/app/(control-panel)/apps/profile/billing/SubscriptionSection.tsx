'use client';

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseLoading from '@fuse/core/FuseLoading';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
	useGetCurrentSubscriptionQuery,
	useGetSubscriptionBillingPaymentsQuery,
	useOnboardSubscriptionMutation
} from '../../../billing/SubscriptionApi';
import { CHOOSEABLE_SUBSCRIPTION_PLANS, type ChooseablePlan } from '../../../billing/subscriptionPlans';
import { useGetBillingCatalogQuery } from '../../../billing/BillingCatalogApi';
import { buildChooseablePlansFromCatalog } from '../../../billing/buildPlansFromCatalog';
import '../../../billing/BillingCatalogApi';

function PlanFeatureList({ plan }: { plan: ChooseablePlan }) {
	return (
		<Box component="ul" className="mt-2 list-disc pl-5">
			{plan.features.map((line) => (
				<Typography key={line} component="li" variant="body2" color="text.secondary" className="mb-0.5">
					{line}
				</Typography>
			))}
		</Box>
	);
}

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

export default function SubscriptionSection() {
	const router = useRouter();
	const { data: _sub, isLoading: loadingSub, refetch: refetchSub } = useGetCurrentSubscriptionQuery();
	const { data: payments, isLoading: loadingPayments } = useGetSubscriptionBillingPaymentsQuery();
	const [onboardSubscription, { isLoading: onboarding }] = useOnboardSubscriptionMutation();
	const [chooseError, setChooseError] = useState<string | null>(null);

	const sub = _sub?.subscription;
	const planName = sub?.name || 'Subscription';
	const billingCycle = sub?.subscription_type === 2 ? 'yearly' : 'monthly';
	const currency = sub?.currency || 'GHS';
	const amount = Number(sub?.amount ?? 0) || 0;
	const nextBilling = sub?.end_at || '';
	const subscriptionActive = String(sub?.status || '').toLowerCase() === 'active';
	const hasSubscription = Boolean(sub?.id);
	const hasRecentPayments = Array.isArray(payments) && payments.length > 0;
	const { data: catalog } = useGetBillingCatalogQuery({ grouped: true });
	const plans = useMemo(() => {
		const fromCatalog = buildChooseablePlansFromCatalog(catalog);
		return fromCatalog.length > 0 ? fromCatalog : CHOOSEABLE_SUBSCRIPTION_PLANS;
	}, [catalog]);
	const planRankByName: Record<string, number> = { Free: 1, Basic: 2, Standard: 3, Premium: 4 };
	const currentRank = planRankByName[planName] ?? 0;
	const selectablePlans =
		subscriptionActive && currentRank > 0
			? plans.filter((p) => p.key > currentRank)
			: plans;

	const handleChoosePlan = async (subscription_type: number) => {
		setChooseError(null);
		try {
			const created = await onboardSubscription({ subscription_type }).unwrap();
			const selectedPlan = plans.find((p) => p.key === subscription_type);
			const params = new URLSearchParams();
			if (selectedPlan?.name) params.set('plan', selectedPlan.name);
			if (created?.id) params.set('subscription_id', String(created.id));
			if (created?.amount != null) params.set('amount', String(created.amount));
			if (created?.is_upgrade && created?.upgrade_credit_days > 0) {
				params.set('upgrade_bonus_days', String(created.upgrade_bonus_days));
				if (created.upgrade_credit_value_ghs != null) {
					params.set('upgrade_credit_ghs', String(created.upgrade_credit_value_ghs));
				}
			}
			const query = params.toString();
			await refetchSub();
			router.push(`/apps/profile/billing/payment${query ? `?${query}` : ''}`);
		} catch (e: any) {
			setChooseError(
				e?.data?.message ||
					e?.data?.error ||
					'Could not start subscription checkout. Please try again.'
			);
		}
	};

	return (
		<Paper id="subscription-plans" className="rounded-xl p-6 shadow-sm">
			<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<Box className="flex items-center gap-2">
					<Box
						className="flex shrink-0 items-center justify-center rounded-lg"
						sx={{ width: 40, height: 40, bgcolor: 'primary.main', color: 'primary.contrastText' }}
					>
						<FuseSvgIcon size={22}>heroicons-outline:credit-card</FuseSvgIcon>
					</Box>
					<Box>
						<Typography variant="h6" className="font-semibold">
							Subscription & billing
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Plan, renewals, and billing payments
						</Typography>
					</Box>
				</Box>
				{!loadingSub ? (
					<Chip
						size="small"
						label={`${planName} · ${subscriptionActive ? 'Active' : String(sub?.status || '—')}`}
						color={subscriptionActive ? 'success' : 'default'}
						variant={subscriptionActive ? 'filled' : 'outlined'}
					/>
				) : null}
			</div>

			<Paper variant="outlined" className="mb-4 rounded-xl p-4" sx={{ borderColor: 'divider' }}>
				{chooseError ? (
					<Alert severity="error" className="mb-4">
						{chooseError}
					</Alert>
				) : null}
				{!loadingSub && !hasSubscription ? (
					<Box>
						<Typography variant="subtitle1" fontWeight={600} className="mb-2">
							Choose a subscription plan
						</Typography>
						<Typography variant="body2" color="text.secondary" className="mb-4">
							No subscription is linked yet. Select a plan to continue and proceed to payment.
						</Typography>
						<Stack spacing={2}>
							{plans.map((plan) => (
								<Paper key={plan.key} variant="outlined" className="rounded-lg p-4" sx={{ borderColor: 'divider' }}>
									<Box className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
										<Box>
											<Typography variant="subtitle1" fontWeight={700}>
												{plan.name}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												{plan.description}
											</Typography>
											<PlanFeatureList plan={plan} />
										</Box>
										<Box className="flex items-center gap-3">
											<Typography className="text-lg font-semibold">
												GHS {plan.amount}
												<Typography component="span" variant="caption" color="text.secondary" className="ml-1">
													/ {plan.billing}
												</Typography>
											</Typography>
											<Button
												variant="contained"
												color="primary"
												disabled={onboarding}
												onClick={() => handleChoosePlan(plan.key)}
											>
												{onboarding ? 'Processing...' : 'Choose'}
											</Button>
										</Box>
									</Box>
								</Paper>
							))}
						</Stack>
					</Box>
				) : (
					<>
						<Box className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex-1">
								{loadingSub ? (
									<FuseLoading />
								) : (
									<>
										<Typography className="text-xl font-bold">{planName}</Typography>
										<Typography variant="body2" color="text.secondary" className="capitalize">
											{billingCycle} billing
										</Typography>
										{sub?.limits ? (
											<Typography variant="caption" color="text.secondary" className="mt-1 block">
												Plan usage: {sub.limits.userCount}/{sub.limits.maxUsers} users,{' '}
												{sub.limits.warehouseCount}/{sub.limits.maxWarehouses} branches,{' '}
												{sub.limits.locationCount}/{sub.limits.maxLocations} locations
											</Typography>
										) : null}
									</>
								)}
							</div>
							<Box className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
								<Typography className="text-2xl font-bold">
									{currency} {amount}
									<span className="text-base font-normal text-secondary">
										/{billingCycle === 'yearly' ? 'yr' : 'mo'}
									</span>
								</Typography>
								<Typography variant="caption" color="text.secondary">
									Next billing: {nextBilling ? new Date(nextBilling).toLocaleDateString('en-US') : '—'}
								</Typography>
								{!subscriptionActive && nextBilling ? (
									<Button
										component={NavLinkAdapter}
										to="/apps/profile/billing/payment"
										variant="contained"
										color="primary"
										size="small"
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:credit-card</FuseSvgIcon>}
									>
										Make payment
									</Button>
								) : null}
							</Box>
						</Box>
						{subscriptionActive && selectablePlans.length > 0 ? (
							<Box className="mt-6 border-t pt-6" sx={{ borderColor: 'divider' }}>
								<Alert severity="info" className="mb-4">
									Upgrading adds the value of your remaining {planName} days as extra time on the new plan after
									payment (prorated). Your current plan stays active until checkout completes.
								</Alert>
								<Typography variant="subtitle1" fontWeight={600} className="mb-3">
									Upgrade plan
								</Typography>
								<Stack spacing={2}>
									{selectablePlans.map((plan) => (
										<Paper key={plan.key} variant="outlined" className="rounded-lg p-4" sx={{ borderColor: 'divider' }}>
											<Box className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
												<Box>
													<Typography variant="subtitle1" fontWeight={700}>
														{plan.name}
													</Typography>
													<Typography variant="body2" color="text.secondary">
														{plan.description}
													</Typography>
													<PlanFeatureList plan={plan} />
												</Box>
												<Box className="flex items-center gap-3">
													<Typography className="text-lg font-semibold">
														GHS {plan.amount}
														<Typography component="span" variant="caption" color="text.secondary" className="ml-1">
															/ {plan.billing}
														</Typography>
													</Typography>
													<Button
														variant="contained"
														color="primary"
														disabled={onboarding}
														onClick={() => handleChoosePlan(plan.key)}
													>
														{onboarding ? 'Processing...' : 'Upgrade'}
													</Button>
												</Box>
											</Box>
										</Paper>
									))}
								</Stack>
							</Box>
						) : null}
						{subscriptionActive && selectablePlans.length === 0 ? (
							<Typography variant="body2" color="text.secondary" className="mt-4">
								You are on the highest plan. Contact support for custom arrangements.
							</Typography>
						) : null}
					</>
				)}
			</Paper>

			{(loadingPayments || hasRecentPayments) && (
				<Paper variant="outlined" className="overflow-hidden rounded-xl" sx={{ borderColor: 'divider' }}>
					<Box
						className="flex items-center justify-between gap-2 border-b p-4"
						sx={{ borderColor: 'divider' }}
					>
						<Typography variant="subtitle2" fontWeight={600}>
							Recent billing payments
						</Typography>
						<Button
							component={NavLinkAdapter}
							to="/apps/profile/payments"
							variant="text"
							size="small"
							endIcon={<FuseSvgIcon size={16}>heroicons-outline:arrow-right</FuseSvgIcon>}
						>
							View all
						</Button>
					</Box>
					<Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
					<Table size="small" sx={{ minWidth: 480 }}>
						<TableHead>
							<TableRow>
								<TableCell>Date</TableCell>
								<TableCell>Amount</TableCell>
								<TableCell>Method</TableCell>
								<TableCell>Status</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{loadingPayments ? (
								<TableRow>
									<TableCell colSpan={4}>
										<FuseLoading />
									</TableCell>
								</TableRow>
							) : (
								(payments || []).slice(0, 3).map((row) => (
									<TableRow key={row.id || row.transaction_ref}>
										<TableCell>
											{row.created_at
												? new Date(row.created_at).toLocaleString('en-US', {
														month: 'short',
														day: 'numeric',
														year: 'numeric'
													})
												: '—'}
										</TableCell>
										<TableCell>
											{row.currency || currency} {Number(row.amount || 0).toFixed(2)}
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
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
					</Box>
				</Paper>
			)}
		</Paper>
	);
}
