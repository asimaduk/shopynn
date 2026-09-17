'use client';

import { useEffect, useState } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useRouter } from 'next/navigation';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import FuseLoading from '@fuse/core/FuseLoading';
import {
	CompanyProfile,
	useGetCompanyProfileQuery,
	useUpdateCompanyProfileMutation
} from './CompanyProfileApi';
import { DEFAULT_BULK_DISCOUNT } from '@/utils/bulkDiscount';
import toast from 'react-hot-toast';

export default function CompanyProfilePage() {
	const router = useRouter();
	const { data: profile, isLoading } = useGetCompanyProfileQuery(undefined, { refetchOnMountOrArgChange: true });
	const [updateProfile, { isLoading: submitting }] = useUpdateCompanyProfileMutation();
	const [bulkEnabled, setBulkEnabled] = useState(DEFAULT_BULK_DISCOUNT.enabled);
	const [bulkThreshold, setBulkThreshold] = useState(String(DEFAULT_BULK_DISCOUNT.quantity_threshold));

	useEffect(() => {
		if (!profile?.bulkDiscount) return;
		setBulkEnabled(Boolean(profile.bulkDiscount.enabled));
		setBulkThreshold(String(profile.bulkDiscount.quantity_threshold || DEFAULT_BULK_DISCOUNT.quantity_threshold));
	}, [profile]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		const formData = new FormData(form);
		const thresholdNum = Math.max(1, Math.min(9999, parseInt(bulkThreshold, 10) || DEFAULT_BULK_DISCOUNT.quantity_threshold));
		const payload: Partial<CompanyProfile> = {
			companyName: (formData.get('companyName') as string)?.trim() || '',
			address: (formData.get('address') as string)?.trim() || undefined,
			phone: (formData.get('phone') as string)?.trim() || undefined,
			email: (formData.get('email') as string)?.trim() || undefined,
			website: (formData.get('website') as string)?.trim() || undefined,
			bulkDiscount: {
				enabled: bulkEnabled,
				quantity_threshold: thresholdNum
			}
		};
		if (!payload.companyName) {
			toast.error('Company name is required');
			return;
		}
		try {
			await updateProfile(payload).unwrap();
			toast.success('Company profile saved');
			router.push('/');
		} catch (err) {
			toast.error('Failed to save. Please try again.');
		}
	};

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full min-h-full flex flex-col px-4 py-6">
				<Box className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
					<Box className="flex items-center gap-3">
						<Box
							className="flex items-center justify-center rounded-xl shrink-0"
							sx={{
								width: 48,
								height: 48,
								bgcolor: 'primary.main',
								color: 'primary.contrastText'
							}}
						>
							<FuseSvgIcon size={26}>heroicons-outline:building-office-2</FuseSvgIcon>
						</Box>
						<div>
							<Typography variant="h5" fontWeight="bold">
								Company profile
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Set up your company information
							</Typography>
						</div>
					</Box>
				</Box>

				<Box className="w-full flex justify-center">
					<Box className="max-w-2xl w-full">
						<Paper variant="outlined" className="p-6 rounded-xl" sx={{ borderColor: 'divider' }}>
							<Box className="flex items-center gap-2 mb-4">
								<FuseSvgIcon size={22} color="action">heroicons-outline:identification</FuseSvgIcon>
								<Typography variant="subtitle1" fontWeight="600">
									Company details
								</Typography>
							</Box>
							<form onSubmit={handleSubmit} className="flex flex-col gap-4">
								<TextField
									name="companyName"
									label="Company name"
									defaultValue={profile?.companyName ?? ''}
									required
									fullWidth
									placeholder="Your company or business name"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">heroicons-outline:building-office-2</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									name="address"
									label="Address"
									defaultValue={profile?.address ?? ''}
									fullWidth
									multiline
									rows={2}
									placeholder="Street, city, region"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
												<FuseSvgIcon size={20} color="action">heroicons-outline:map-pin</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									name="phone"
									label="Phone"
									defaultValue={profile?.phone ?? ''}
									fullWidth
									placeholder="+233 XX XXX XXXX"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">heroicons-outline:phone</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									name="email"
									label="Email"
									type="email"
									defaultValue={profile?.email ?? ''}
									fullWidth
									placeholder="contact@company.com"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">heroicons-outline:envelope</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									name="website"
									label="Website"
									defaultValue={profile?.website ?? ''}
									fullWidth
									placeholder="https://www.example.com"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">heroicons-outline:globe-alt</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>

								<Box
									className="rounded-xl p-4 flex flex-col gap-3"
									sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
								>
									<Box className="flex items-center gap-2">
										<FuseSvgIcon size={20} color="action">heroicons-outline:tag</FuseSvgIcon>
										<Typography variant="subtitle2" fontWeight={600}>
											Bulk / wholesale discount
										</Typography>
									</Box>
									<Typography variant="body2" color="text.secondary">
										When enabled, New Sale uses each product&apos;s wholesale (alt) price once the line
										quantity reaches the threshold. Off by default.
									</Typography>
									<FormControlLabel
										control={
											<Switch
												checked={bulkEnabled}
												onChange={(e) => setBulkEnabled(e.target.checked)}
												color="primary"
											/>
										}
										label="Enable bulk discount"
									/>
									<TextField
										label="Apply wholesale price when quantity ≥"
										value={bulkThreshold}
										onChange={(e) => setBulkThreshold(e.target.value.replace(/[^0-9]/g, ''))}
										disabled={!bulkEnabled}
										fullWidth
										inputProps={{ inputMode: 'numeric', min: 1 }}
										helperText="Example: 10 means qty 10+ uses wholesale price"
									/>
								</Box>

								<Box className="flex gap-2 pt-2">
									<Button
										type="submit"
										variant="contained"
										color="primary"
										disabled={submitting}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:check</FuseSvgIcon>}
									>
										{submitting ? 'Saving…' : 'Save and continue'}
									</Button>
								</Box>
							</form>
						</Paper>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
							Complete this form to finish setting up your account. You can update it later in settings.
						</Typography>
					</Box>
				</Box>
			</div>
		</>
	);
}
