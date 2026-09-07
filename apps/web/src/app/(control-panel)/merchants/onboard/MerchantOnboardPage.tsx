'use client';

import { useMemo, useState } from 'react';
import Link from '@fuse/core/Link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetMerchantMeQuery, useOnboardBusinessMutation, type MerchantOnboardPayload } from '../MerchantApi';
import { useRouter } from 'next/navigation';
import { toGroupedBillingCatalog, useGetBillingCatalogQuery } from '../../billing/BillingCatalogApi';
import { buildChooseablePlansFromCatalog, getOnboardingAmountFromCatalog } from '../../billing/buildPlansFromCatalog';
import '../../billing/BillingCatalogApi';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

const FALLBACK_OPTIONS = [
	{ value: 1, label: 'Free (14 days)' },
	{ value: 2, label: 'Basic' },
	{ value: 3, label: 'Standard' },
	{ value: 4, label: 'Premium' }
];

export default function MerchantOnboardPage() {
	const router = useRouter();
	const { data: meData, isLoading: loadingMe } = useGetMerchantMeQuery();
	const merchant = meData?.merchant ?? null;
	const [onboard, { isLoading: submitting }] = useOnboardBusinessMutation();
	const { data: catalogData } = useGetBillingCatalogQuery({ grouped: true });
	const catalog = toGroupedBillingCatalog(catalogData);
	const [addonCodes, setAddonCodes] = useState<string[]>([]);

	const subscriptionOptions = useMemo(() => {
		const plans = buildChooseablePlansFromCatalog(catalog);
		const opts = [{ value: 1, label: 'Free (14 days)' }];
		for (const p of plans) {
			const onboarding = getOnboardingAmountFromCatalog(catalog, p.key);
			opts.push({
				value: p.key,
				label: `${p.name} — GHS ${p.amount}/mo${onboarding > 0 ? ` (+ GHS ${onboarding} onboarding)` : ''}`
			});
		}
		return opts.length > 1 ? opts : FALLBACK_OPTIONS;
	}, [catalog]);

	const [form, setForm] = useState({
		name: '',
		// organization: '',
		phone: '',
		email: '',
		address: '',
		city: '',
		state: '',
		country: '',
		postal_code: '',
		website: '',
		notes: '',
		subscription_type: 1,
		first_name: '',
		last_name: '',
		owner_email: '',
		owner_phone: '',
		password: '',
		product_categorization: ''
	});

	const quoteTotal = useMemo(() => {
		const type = Number(form.subscription_type);
		if (type === 1) {
			return (catalog?.addons || [])
				.filter((a) => addonCodes.includes(a.code))
				.reduce((s, a) => s + Number(a.amount_ghs), 0);
		}
		const onboarding = getOnboardingAmountFromCatalog(catalog, type);
		const plan = buildChooseablePlansFromCatalog(catalog).find((p) => p.key === type);
		const monthly = plan?.amount ?? 0;
		const addons = (catalog?.addons || [])
			.filter((a) => addonCodes.includes(a.code))
			.reduce((s, a) => s + Number(a.amount_ghs), 0);
		return onboarding + monthly + addons;
	}, [catalog, form.subscription_type, addonCodes]);

	const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!merchant) {
			toast.error('You are not registered as a merchant.');
			return;
		}
		const pc = form.product_categorization.trim();
		const payload: MerchantOnboardPayload = {
			name: form.name.trim() || undefined,
			// organization: form.organization.trim() || undefined,
			phone: form.phone.trim(),
			email: form.email.trim(),
			address: form.address.trim(),
			city: form.city.trim() || undefined,
			state: form.state.trim() || undefined,
			country: form.country.trim() || undefined,
			postal_code: form.postal_code.trim() || undefined,
			website: form.website.trim() || undefined,
			notes: form.notes.trim() || undefined,
			subscription_type: Number(form.subscription_type),
			addon_codes: addonCodes,
			first_name: form.first_name.trim(),
			last_name: form.last_name.trim(),
			owner_email: form.owner_email.trim().toLowerCase(),
			owner_phone: form.owner_phone.trim(),
			password: form.password.trim() || undefined,
			registration_method: 'manual',
			product_categorization: pc === '' ? undefined : Number(pc)
		};

		if (!payload.phone || !payload.email || !payload.address) {
			toast.error('Company phone, email and address are required.');
			return;
		}
		if (!payload.first_name || !payload.last_name || !payload.owner_email || !payload.owner_phone) {
			toast.error('Owner first name, last name, email and phone are required.');
			return;
		}
		if (payload.subscription_type == null || payload.subscription_type < 1 || payload.subscription_type > 4) {
			toast.error('Choose a subscription plan.');
			return;
		}

		try {
			const result = await onboard(payload).unwrap();
			toast.success('Business onboarded successfully.');
			if (result?.payment_required && result?.tenant?.id) {
				router.push(`/merchants/collect/${result.tenant.id}`);
				return;
			}
			router.push('/merchants');
		} catch (err: any) {
			const msg =
				err?.data?.message ||
				err?.data?.data?.message ||
				(Array.isArray(err?.data?.errors) ? err.data.errors.join(', ') : null) ||
				err?.error ||
				'Onboarding failed';
			toast.error(String(msg));
		}
	};

	if (loadingMe) {
		return (
			<Box className="p-8">
				<Typography>Loading…</Typography>
			</Box>
		);
	}

	if (!merchant) {
		return (
			<Box className="mx-auto max-w-lg p-6">
				<PageBreadcrumb className="mb-4" />
				<Paper className="p-6" variant="outlined">
					<Typography>Merchant access required.</Typography>
					<Button component={Link} to="/merchants" className="mt-4">
						Back
					</Button>
				</Paper>
			</Box>
		);
	}

	return (
		<Box className="mx-auto max-w-4xl p-6">
			<PageBreadcrumb className="mb-4" />

			<div className="mb-4 flex items-center justify-between gap-4">
				<Typography variant="h4" className="font-bold tracking-tight">
					Onboard business
				</Typography>
				<Button
					component={Link}
					to="/merchants"
					startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					color="inherit"
				>
					Back to dashboard
				</Button>
			</div>

			<Paper className="rounded-2xl p-6" component="form" onSubmit={handleSubmit} variant="outlined">
				<Typography variant="subtitle1" fontWeight={700} className="mb-4">
					Company / tenant
				</Typography>
				<Grid container spacing={2}>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							label="Business name"
							value={form.name}
							onChange={(e) => set('name', e.target.value)}
						/>
					</Grid>
					{/* <Grid item xs={12} md={6}>
						<TextField
							fullWidth
							label="Organization"
							value={form.organization}
							onChange={(e) => set('organization', e.target.value)}
						/>
					</Grid> */}
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							label="Company phone"
							value={form.phone}
							onChange={(e) => set('phone', e.target.value)}
						/>
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							label="Company email"
							type="email"
							value={form.email}
							onChange={(e) => set('email', e.target.value)}
						/>
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							label="Address"
							value={form.address}
							onChange={(e) => set('address', e.target.value)}
						/>
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField fullWidth label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField fullWidth label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							label="Country"
							value={form.country}
							onChange={(e) => set('country', e.target.value)}
						/>
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							label="Postal code"
							value={form.postal_code}
							onChange={(e) => set('postal_code', e.target.value)}
						/>
					</Grid>
					{/* <Grid item xs={12} md={8}>
						<TextField
							fullWidth
							label="Website"
							value={form.website}
							onChange={(e) => set('website', e.target.value)}
						/>
					</Grid> */}
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							select
							required
							label="Subscription plan"
							value={form.subscription_type}
							onChange={(e) => set('subscription_type', Number(e.target.value))}
						>
							{subscriptionOptions.map((o) => (
								<MenuItem key={o.value} value={o.value}>
									{o.label}
								</MenuItem>
							))}
						</TextField>
					</Grid>
					{(catalog?.addons?.length ?? 0) > 0 ? (
						<Grid item xs={12}>
							<Typography variant="subtitle2" className="mb-2">
								Optional add-ons
							</Typography>
							{catalog!.addons.map((a) => (
								<FormControlLabel
									key={a.code}
									control={
										<Checkbox
											checked={addonCodes.includes(a.code)}
											onChange={(e) => {
												setAddonCodes((prev) =>
													e.target.checked
														? [...prev, a.code]
														: prev.filter((c) => c !== a.code)
												);
											}}
										/>
									}
									label={`${a.label} — GHS ${Number(a.amount_ghs).toFixed(2)}`}
								/>
							))}
							{quoteTotal > 0 ? (
								<Typography fontWeight={700} color="secondary">
									Total due at collection: GHS {quoteTotal.toFixed(2)}
								</Typography>
							) : null}
						</Grid>
					) : null}
					{/* <Grid item xs={12} md={3}>
						<TextField
							fullWidth
							label="Product categorization (optional)"
							value={form.product_categorization}
							onChange={(e) => set('product_categorization', e.target.value)}
						/>
					</Grid> */}
					<Grid item xs={12}>
						<TextField
							fullWidth
							multiline
							minRows={2}
							label="Notes"
							value={form.notes}
							onChange={(e) => set('notes', e.target.value)}
						/>
					</Grid>
				</Grid>

				<Typography variant="subtitle1" fontWeight={700} className="mb-4 mt-8">
					Initial admin (business owner)
				</Typography>
				<Grid container spacing={2}>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							label="First name"
							value={form.first_name}
							onChange={(e) => set('first_name', e.target.value)}
						/>
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							label="Last name"
							value={form.last_name}
							onChange={(e) => set('last_name', e.target.value)}
						/>
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							type="email"
							label="Owner email (login)"
							value={form.owner_email}
							onChange={(e) => set('owner_email', e.target.value)}
						/>
					</Grid>
					<Grid item xs={12} md={6}>
						<TextField
							fullWidth
							required
							label="Owner phone"
							value={form.owner_phone}
							onChange={(e) => set('owner_phone', e.target.value)}
						/>
					</Grid>
					{/* <Grid item xs={12} md={6}>
						<TextField
							fullWidth
							type="password"
							label="Password (optional)"
							helperText="If empty, a temporary password path may apply per server config"
							value={form.password}
							onChange={(e) => set('password', e.target.value)}
						/>
					</Grid> */}
				</Grid>

				<Box className="mt-8 flex justify-end gap-2">
					<Button component={Link} to="/merchants" color="inherit">
						Cancel
					</Button>
					<Button type="submit" variant="contained" color="secondary" disabled={submitting}>
						Create account
					</Button>
				</Box>
			</Paper>
		</Box>
	);
}
