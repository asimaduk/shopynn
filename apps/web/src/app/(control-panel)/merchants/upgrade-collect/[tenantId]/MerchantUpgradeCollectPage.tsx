'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@fuse/core/Link';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import FuseLoading from '@fuse/core/FuseLoading';
import {
	useCreatePayLaterQuoteMutation,
	useGetOnboardedTenantsQuery
} from '../../MerchantApi';
import { toGroupedBillingCatalog, useGetBillingCatalogQuery } from '../../../billing/BillingCatalogApi';
import {
	buildChooseablePlansFromCatalog,
	getOnboardingAmountFromCatalog
} from '../../../billing/buildPlansFromCatalog';
import '../../../billing/BillingCatalogApi';

export default function MerchantUpgradeCollectPage() {
	const router = useRouter();
	const { tenantId } = useParams<{ tenantId: string }>();
	const { data: tenantsData, isLoading: loadingTenants } = useGetOnboardedTenantsQuery();
	const { data: catalogData, isLoading: loadingCatalog } = useGetBillingCatalogQuery({ grouped: true });
	const catalog = toGroupedBillingCatalog(catalogData);
	const [createQuote, { isLoading: creating }] = useCreatePayLaterQuoteMutation();
	const [subscriptionType, setSubscriptionType] = useState(3);
	const [addonCodes, setAddonCodes] = useState<string[]>([]);
	const [ownerEmail, setOwnerEmail] = useState('');

	const tenant = tenantsData?.tenants?.find((t) => t.id === tenantId);
	const paidPlans = useMemo(() => buildChooseablePlansFromCatalog(catalog), [catalog]);

	useEffect(() => {
		if (tenant?.email) {
			setOwnerEmail((prev) => (prev ? prev : tenant.email || ''));
		}
	}, [tenant?.email]);

	const quoteTotal = useMemo(() => {
		const type = Number(subscriptionType);
		const onboarding = getOnboardingAmountFromCatalog(catalog, type);
		const plan = paidPlans.find((p) => p.key === type);
		const monthly = plan?.amount ?? 0;
		const addons = (catalog?.addons || [])
			.filter((a) => addonCodes.includes(a.code))
			.reduce((s, a) => s + Number(a.amount_ghs), 0);
		return onboarding + monthly + addons;
	}, [catalog, subscriptionType, addonCodes, paidPlans]);

	const handleSubmit = async () => {
		if (!tenantId) return;
		if (subscriptionType < 2) {
			toast.error('Choose Basic, Standard, or Premium.');
			return;
		}
		try {
			await createQuote({
				tenantId,
				quote_kind: 'upgrade_collect',
				subscription_type: subscriptionType,
				addon_codes: addonCodes,
				owner_email: ownerEmail.trim() || undefined
			}).unwrap();
			toast.success('Quote created.');
			router.push(`/merchants/collect/${tenantId}`);
		} catch (err: any) {
			const msg = err?.data?.message || err?.error || 'Failed';
			if (String(msg).toLowerCase().includes('pending')) {
				toast.error('Payment already pending — opening collect.');
				router.push(`/merchants/collect/${tenantId}`);
				return;
			}
			toast.error(String(msg));
		}
	};

	if (loadingTenants || loadingCatalog) return <FuseLoading />;

	return (
		<Box className="mx-auto max-w-lg p-6">
			<PageBreadcrumb className="mb-4" />
			<Typography variant="h4" fontWeight={700} className="mb-2">
				Upgrade & collect
			</Typography>
			<Typography color="text.secondary" className="mb-4">
				{tenant?.name || 'Business'} — paid plan quote (onboarding + first month). Commission applies when
				payment succeeds.
			</Typography>

			<Paper variant="outlined" className="p-4">
				<TextField
					fullWidth
					select
					label="Plan"
					value={subscriptionType}
					onChange={(e) => setSubscriptionType(Number(e.target.value))}
					className="mb-4"
				>
					{paidPlans.map((p) => {
						const onboarding = getOnboardingAmountFromCatalog(catalog, p.key);
						return (
							<MenuItem key={p.key} value={p.key}>
								{p.name} — GHS {p.amount}/mo
								{onboarding > 0 ? ` (+ GHS ${onboarding} onboarding)` : ''}
							</MenuItem>
						);
					})}
				</TextField>

				<TextField
					fullWidth
					label="Owner email (card checkout)"
					type="email"
					value={ownerEmail}
					onChange={(e) => setOwnerEmail(e.target.value)}
					className="mb-4"
				/>

				{(catalog?.addons || []).length > 0 ? (
					<Typography variant="subtitle2" className="mb-2">
						Optional add-ons
					</Typography>
				) : null}
				{(catalog?.addons || []).map((a) => (
					<FormControlLabel
						key={a.code}
						control={
							<Checkbox
								checked={addonCodes.includes(a.code)}
								onChange={(e) => {
									setAddonCodes((prev) =>
										e.target.checked ? [...prev, a.code] : prev.filter((c) => c !== a.code)
									);
								}}
							/>
						}
						label={`${a.label} — GHS ${Number(a.amount_ghs).toFixed(2)}`}
					/>
				))}

				{quoteTotal > 0 ? (
					<Typography fontWeight={700} className="mt-2">
						Total: GHS {quoteTotal.toFixed(2)}
					</Typography>
				) : null}

				<Box className="mt-4 flex gap-2 justify-end">
					<Button component={Link} to="/merchants" color="inherit">
						Cancel
					</Button>
					<Button variant="contained" disabled={creating || quoteTotal <= 0} onClick={handleSubmit}>
						{creating ? 'Creating…' : 'Create quote & collect'}
					</Button>
				</Box>
			</Paper>

			<Button
				component={Link}
				to="/merchants"
				startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
				className="mt-4"
			>
				Back to merchants
			</Button>
		</Box>
	);
}
