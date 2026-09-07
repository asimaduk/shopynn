'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@fuse/core/Link';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
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
import '../../../billing/BillingCatalogApi';

export default function MerchantAddServicesPage() {
	const router = useRouter();
	const { tenantId } = useParams<{ tenantId: string }>();
	const { data: tenantsData, isLoading: loadingTenants } = useGetOnboardedTenantsQuery();
	const { data: catalogData, isLoading: loadingCatalog } = useGetBillingCatalogQuery({ grouped: true });
	const catalog = toGroupedBillingCatalog(catalogData);
	const [createQuote, { isLoading: creating }] = useCreatePayLaterQuoteMutation();
	const [addonCodes, setAddonCodes] = useState<string[]>([]);
	const [ownerEmail, setOwnerEmail] = useState('');

	const tenant = tenantsData?.tenants?.find((t) => t.id === tenantId);

	useEffect(() => {
		if (tenant?.email) {
			setOwnerEmail((prev) => (prev ? prev : tenant.email || ''));
		}
	}, [tenant?.email]);

	const total = useMemo(() => {
		return (catalog?.addons || [])
			.filter((a) => addonCodes.includes(a.code))
			.reduce((s, a) => s + Number(a.amount_ghs), 0);
	}, [catalog, addonCodes]);

	const handleSubmit = async () => {
		if (!tenantId) return;
		if (addonCodes.length === 0) {
			toast.error('Select at least one service.');
			return;
		}
		try {
			await createQuote({
				tenantId,
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
				Add services
			</Typography>
			<Typography color="text.secondary" className="mb-4">
				{tenant?.name || 'Business'} — paid setup add-ons (quote + one payment).
			</Typography>

			<Paper variant="outlined" className="p-4">
				<TextField
					fullWidth
					label="Owner email (card checkout)"
					type="email"
					value={ownerEmail}
					onChange={(e) => setOwnerEmail(e.target.value)}
					className="mb-4"
				/>

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

				{total > 0 ? (
					<Typography fontWeight={700} className="mt-2">
						Total: GHS {total.toFixed(2)}
					</Typography>
				) : null}

				<Box className="mt-4 flex gap-2 justify-end">
					<Button component={Link} to="/merchants" color="inherit">
						Cancel
					</Button>
					<Button variant="contained" disabled={creating || addonCodes.length === 0} onClick={handleSubmit}>
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
