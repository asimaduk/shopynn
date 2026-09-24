'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import { useRouter } from 'next/navigation';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import FuseLoading from '@fuse/core/FuseLoading';
import {
	CompanyProfile,
	useGetCompanyProfileQuery,
	useGetIndustriesForCompanyQuery,
	useUpdateCompanyProfileMutation,
	useUploadCompanyLogoMutation,
	isCompanyProfileSet
} from './CompanyProfileApi';
import { DEFAULT_BULK_DISCOUNT } from '@/utils/bulkDiscount';
import { URLS } from '@/configs/settingsConfig';
import toast from 'react-hot-toast';

const OTHER_INDUSTRY = 'other';

function logoSrc(logoKey?: string | null) {
	const key = String(logoKey || '').trim();
	if (!key) return '';
	if (/^https?:\/\//i.test(key) || key.startsWith('blob:') || key.startsWith('data:')) return key;
	return `${URLS.serverUrl}/images?id=${encodeURIComponent(key)}`;
}

export default function CompanyProfilePage() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { data: profile, isLoading } = useGetCompanyProfileQuery(undefined, { refetchOnMountOrArgChange: true });
	const { data: industries = [] } = useGetIndustriesForCompanyQuery();
	const [updateProfile, { isLoading: submitting }] = useUpdateCompanyProfileMutation();
	const [uploadLogo, { isLoading: uploading }] = useUploadCompanyLogoMutation();

	const profileAlreadySet = isCompanyProfileSet(profile);

	const [companyName, setCompanyName] = useState('');
	const [organization, setOrganization] = useState('');
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');
	const [website, setWebsite] = useState('');
	const [industryId, setIndustryId] = useState('');
	const [industryOther, setIndustryOther] = useState('');
	const [bulkEnabled, setBulkEnabled] = useState(DEFAULT_BULK_DISCOUNT.enabled);
	const [bulkThreshold, setBulkThreshold] = useState(String(DEFAULT_BULK_DISCOUNT.quantity_threshold));
	const [logoKey, setLogoKey] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState('');
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [removeLogo, setRemoveLogo] = useState(false);
	const previewUrlRef = useRef('');

	useEffect(() => {
		if (!profile) return;
		setCompanyName(profile.companyName || '');
		setOrganization(profile.organization || profile.companyName || '');
		setAddress(profile.address || '');
		setPhone(profile.phone || '');
		setEmail(profile.email || '');
		setWebsite(profile.website || '');
		setBulkEnabled(Boolean(profile.bulkDiscount?.enabled));
		setBulkThreshold(
			String(profile.bulkDiscount?.quantity_threshold || DEFAULT_BULK_DISCOUNT.quantity_threshold)
		);

		// Don't wipe a just-selected file preview when profile/industries re-sync.
		if (!pendingFile && !previewUrlRef.current) {
			setLogoKey(profile.logo ?? null);
			setRemoveLogo(false);
			setPreviewUrl('');
		} else if (!pendingFile) {
			setLogoKey(profile.logo ?? null);
		}

		const savedId = profile.industryId ? String(profile.industryId) : '';
		const savedLabel = profile.industryLabel || '';
		if (savedId && industries.some((i) => String(i.id) === savedId)) {
			setIndustryId(savedId);
			setIndustryOther('');
		} else if (savedLabel && industries.some((i) => i.name.toLowerCase() === savedLabel.toLowerCase())) {
			const match = industries.find((i) => i.name.toLowerCase() === savedLabel.toLowerCase());
			setIndustryId(match?.id || '');
			setIndustryOther('');
		} else if (savedLabel) {
			setIndustryId(OTHER_INDUSTRY);
			setIndustryOther(savedLabel);
		} else {
			setIndustryId('');
			setIndustryOther('');
		}
		// pendingFile intentionally omitted — we only guard against clearing an active preview
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [profile, industries]);

	useEffect(() => {
		previewUrlRef.current = previewUrl;
	}, [previewUrl]);

	useEffect(() => {
		return () => {
			const url = previewUrlRef.current;
			if (url.startsWith('blob:')) URL.revokeObjectURL(url);
		};
	}, []);

	const displayLogoUrl = previewUrl || (!removeLogo ? logoSrc(logoKey) : '');

	const industryOptions = useMemo(
		() => [...industries, { id: OTHER_INDUSTRY, name: 'Specify other', description: null }],
		[industries]
	);

	const revokePreview = () => {
		const url = previewUrlRef.current;
		if (url.startsWith('blob:')) URL.revokeObjectURL(url);
		previewUrlRef.current = '';
	};

	const onPickLogo = (file: File | null) => {
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast.error('Please choose an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error('Logo must be under 5 MB.');
			return;
		}
		revokePreview();
		const nextUrl = URL.createObjectURL(file);
		previewUrlRef.current = nextUrl;
		setPendingFile(file);
		setRemoveLogo(false);
		setPreviewUrl(nextUrl);
	};

	const handleRemoveLogo = () => {
		revokePreview();
		setPendingFile(null);
		setPreviewUrl('');
		setRemoveLogo(true);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const name = companyName.trim();
		if (!name) {
			toast.error('Company name is required');
			return;
		}
		const industryForApi =
			industryId === OTHER_INDUSTRY ? industryOther.trim() : industryId.trim();
		if (!industryForApi) {
			toast.error('Please select your industry or company type.');
			return;
		}

		const thresholdNum = Math.max(
			1,
			Math.min(9999, parseInt(bulkThreshold, 10) || DEFAULT_BULK_DISCOUNT.quantity_threshold)
		);
		const payload: Partial<CompanyProfile> & { industryOther?: string } = {
			companyName: name,
			organization: organization.trim() || name,
			address: address.trim() || undefined,
			phone: phone.trim() || undefined,
			email: email.trim() || undefined,
			website: website.trim() || undefined,
			industryId: industryId || undefined,
			industryOther: industryId === OTHER_INDUSTRY ? industryOther.trim() : undefined,
			bulkDiscount: {
				enabled: bulkEnabled,
				quantity_threshold: thresholdNum
			}
		};

		try {
			if (pendingFile) {
				const uploadBody = new FormData();
				uploadBody.append('file', pendingFile);
				const uploaded = await uploadLogo(uploadBody).unwrap();
				const newKey = Array.isArray(uploaded?.ids) ? uploaded.ids[0] : null;
				if (!newKey) {
					toast.error('Logo upload failed. Please try again.');
					return;
				}
				payload.logo = newKey;
			} else if (removeLogo) {
				payload.logo = null;
			}

			await updateProfile(payload).unwrap();
			revokePreview();
			setPendingFile(null);
			setPreviewUrl('');
			setRemoveLogo(false);
			if (payload.logo !== undefined) {
				setLogoKey(payload.logo);
			}
			toast.success('Company profile saved');
			if (!profileAlreadySet) {
				router.push('/');
			}
		} catch {
			toast.error('Failed to save. Please try again.');
		}
	};

	if (isLoading) {
		return <FuseLoading />;
	}

	const saving = submitting || uploading;

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
								{profileAlreadySet
									? 'Update your company details anytime — all fields stay editable'
									: 'Set up your company information and logo'}
							</Typography>
						</div>
					</Box>
				</Box>

				<Box className="w-full flex justify-center">
					<Box className="max-w-2xl w-full">
						{profileAlreadySet ? (
							<Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
								Your account is set up. You can change any company field below whenever you need —
								including logo, contact details, industry, and bulk discount.
							</Alert>
						) : null}

						<Paper variant="outlined" className="p-6 rounded-xl" sx={{ borderColor: 'divider' }}>
							<Box className="flex items-center gap-2 mb-4">
								<FuseSvgIcon size={22} color="action">
									heroicons-outline:identification
								</FuseSvgIcon>
								<Typography variant="subtitle1" fontWeight="600">
									Company details
								</Typography>
							</Box>
							<form onSubmit={handleSubmit} className="flex flex-col gap-4">
								<Box
									className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
									sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
								>
									<Avatar
										src={displayLogoUrl || undefined}
										alt="Company logo"
										variant="circular"
										imgProps={{
											style: { objectFit: 'cover' }
										}}
										sx={{
											width: 88,
											height: 88,
											bgcolor: 'background.paper',
											border: '1px solid',
											borderColor: pendingFile ? 'primary.main' : 'divider',
											fontSize: 28,
											fontWeight: 700,
											color: 'text.secondary'
										}}
									>
										{(companyName || 'C').trim().charAt(0).toUpperCase()}
									</Avatar>
									<Box className="flex-1 min-w-0">
										<Typography variant="subtitle2" fontWeight={600}>
											Company logo
										</Typography>
										<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
											{pendingFile
												? `Preview: ${pendingFile.name} — save to apply`
												: 'Shown on the mobile For You header next to Shopynn. Square images work best.'}
										</Typography>
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											hidden
											onChange={(e) => {
												onPickLogo(e.target.files?.[0] || null);
												e.target.value = '';
											}}
										/>
										<Box className="flex flex-wrap gap-2">
											<Button
												type="button"
												variant="outlined"
												size="small"
												onClick={() => fileInputRef.current?.click()}
												startIcon={
													<FuseSvgIcon size={16}>heroicons-outline:photo</FuseSvgIcon>
												}
											>
												{displayLogoUrl ? 'Change logo' : 'Upload logo'}
											</Button>
											{displayLogoUrl || logoKey ? (
												<Button
													type="button"
													variant="text"
													size="small"
													color="error"
													onClick={handleRemoveLogo}
													startIcon={
														<FuseSvgIcon size={16}>heroicons-outline:trash</FuseSvgIcon>
													}
												>
													Remove
												</Button>
											) : null}
										</Box>
									</Box>
								</Box>

								<TextField
									label="Company name"
									value={companyName}
									onChange={(e) => setCompanyName(e.target.value)}
									required
									fullWidth
									placeholder="Your company or business name"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">
													heroicons-outline:building-office-2
												</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									label="Organization / display name"
									value={organization}
									onChange={(e) => setOrganization(e.target.value)}
									fullWidth
									placeholder="Shown on receipts (optional)"
									helperText="Defaults to company name if left blank"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">
													heroicons-outline:rectangle-stack
												</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									select
									label="Industry"
									value={industryId}
									onChange={(e) => setIndustryId(e.target.value)}
									fullWidth
									required
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">
													heroicons-outline:briefcase
												</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								>
									<MenuItem value="">
										<em>Select industry</em>
									</MenuItem>
									{industryOptions.map((opt) => (
										<MenuItem key={opt.id} value={opt.id}>
											{opt.name}
										</MenuItem>
									))}
								</TextField>
								{industryId === OTHER_INDUSTRY ? (
									<TextField
										label="Specify industry"
										value={industryOther}
										onChange={(e) => setIndustryOther(e.target.value)}
										fullWidth
										required
										placeholder="Type your industry"
									/>
								) : null}
								<TextField
									label="Address"
									value={address}
									onChange={(e) => setAddress(e.target.value)}
									fullWidth
									multiline
									rows={2}
									placeholder="Street, city, region"
									InputProps={{
										startAdornment: (
											<InputAdornment
												position="start"
												sx={{ alignSelf: 'flex-start', mt: 1.5 }}
											>
												<FuseSvgIcon size={20} color="action">
													heroicons-outline:map-pin
												</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									label="Phone"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									fullWidth
									placeholder="+233 XX XXX XXXX"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">
													heroicons-outline:phone
												</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									label="Email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									fullWidth
									placeholder="contact@company.com"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">
													heroicons-outline:envelope
												</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>
								<TextField
									label="Website"
									value={website}
									onChange={(e) => setWebsite(e.target.value)}
									fullWidth
									placeholder="https://www.example.com"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<FuseSvgIcon size={20} color="action">
													heroicons-outline:globe-alt
												</FuseSvgIcon>
											</InputAdornment>
										)
									}}
								/>

								<Box
									className="rounded-xl p-4 flex flex-col gap-3"
									sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
								>
									<Box className="flex items-center gap-2">
										<FuseSvgIcon size={20} color="action">
											heroicons-outline:tag
										</FuseSvgIcon>
										<Typography variant="subtitle2" fontWeight={600}>
											Bulk / wholesale discount
										</Typography>
									</Box>
									<Typography variant="body2" color="text.secondary">
										When enabled, New Sale uses each product&apos;s wholesale (alt) price once the
										line quantity reaches the threshold. Off by default.
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
										disabled={saving}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:check</FuseSvgIcon>}
									>
										{saving
											? 'Saving…'
											: profileAlreadySet
												? 'Save changes'
												: 'Save and continue'}
									</Button>
								</Box>
							</form>
						</Paper>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
							{profileAlreadySet
								? 'Changes apply immediately across web, receipts, and the customer app.'
								: 'Complete this form to finish setting up your account. You can update every field later.'}
						</Typography>
					</Box>
				</Box>
			</div>
		</>
	);
}
