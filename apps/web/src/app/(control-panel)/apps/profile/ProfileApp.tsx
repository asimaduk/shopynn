'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { motion } from 'motion/react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useUser from '@auth/useUser';
import { canManageSubscription } from '@auth/permissions';
import SubscriptionSection from './billing/SubscriptionSection';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import { useGetMeQuery, useGetMePreferencesQuery, useGetMyMtdSalesQuery, useRemoveMyProfileImageMutation, useUploadMyProfileImageMutation } from './ProfileApi';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';

/**
 * Profile page – shows current user account information (no mock APIs).
 */
function ProfileApp() {
	const { data: session, status } = useSession();
	const { data: user, isGuest, subscriptionExpired } = useUser();
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const { data: me } = useGetMeQuery(undefined, { skip: status !== 'authenticated' });
	const { data: prefs } = useGetMePreferencesQuery();
	const isMerchantUser = Boolean(user?.merchant_id);
	const { data: mtd } = useGetMyMtdSalesQuery(undefined, { skip: isGuest || isMerchantUser });
	const [uploadMyProfileImage] = useUploadMyProfileImageMutation();
	const [removeMyProfileImage] = useRemoveMyProfileImageMutation();

	const displayPhoto = pendingPhotoUrl ?? photoPreview ?? user?.photoURL;

	const handlePhotoClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !file.type.startsWith('image/')) return;
		if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
		const url = URL.createObjectURL(file);
		setPendingPhotoUrl(url);
		setPendingFile(file);
		setUploadError(null);
		e.target.value = '';
	}, [pendingPhotoUrl]);

	const handleClosePreviewModal = useCallback(() => {
		if (uploading) return;
		if (pendingPhotoUrl) {
			URL.revokeObjectURL(pendingPhotoUrl);
			setPendingPhotoUrl(null);
		}
		setPendingFile(null);
		setUploadError(null);
	}, [pendingPhotoUrl, uploading]);

	const handleUploadPhoto = useCallback(async () => {
		if (!pendingPhotoUrl || !pendingFile) return;
		setUploading(true);
		setUploadError(null);
		try {
			await uploadMyProfileImage(pendingFile).unwrap();
			if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
			setPhotoPreview(pendingPhotoUrl);
			setPendingPhotoUrl(null);
			setPendingFile(null);
		} catch (err: any) {
			const message =
				err?.data?.message ||
				err?.error ||
				(typeof err?.data === 'string' ? err.data : null) ||
				'Upload failed. Please try again.';
			setUploadError(String(message));
		} finally {
			setUploading(false);
		}
	}, [pendingPhotoUrl, pendingFile, photoPreview, uploadMyProfileImage]);

	const handleRemovePhoto = useCallback(async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (photoPreview) {
			URL.revokeObjectURL(photoPreview);
			setPhotoPreview(null);
		}
		try {
			await removeMyProfileImage().unwrap();
		} catch {
			// ignore
		}
	}, [photoPreview, removeMyProfileImage]);

	if (status === 'loading') {
		return <FuseLoading />;
	}

	
	const displayName = user?.displayName || `${me?.first_name ?? ''} ${me?.last_name ?? ''}`.trim() || 'User';
	const email = user?.email || '—';
	const role =
		me?.settings?.roles?.map((r) => r?.name).filter(Boolean).join(', ') ||
		user?.settings?.roles?.map((r: any) => r?.name).filter(Boolean).join(', ') ||
		(user?.role
			? Array.isArray(user.role)
				? user.role.join(', ')
				: String(user.role)
			: isGuest
				? 'Guest'
				: '—');
	// const username = user?.username ?? '—';
	// const staffId = user?.staffId ?? '—';
	const phone = me?.phone ?? user?.phone ?? '—';
	const branch = user?.branch ?? (user?.warehouse as { name?: string })?.name ?? '—';
	const companyName = me?.company?.name || '—';
	const companyIndustry = me?.company?.industry || '—';
	const companyAddress = me?.company?.address || '—';
	const companyPhone = me?.company?.phone || '—';
	const companyEmail = me?.company?.email || '—';
	const roles = role;
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('md'));
	const subscriptionAlert = subscriptionExpired ? (
		<Alert severity="warning" className="rounded-xl">
			{session?.subscriptionErrorMessage || 'Subscription is not active.'}
		</Alert>
	) : null;
	const showSubscription = canManageSubscription(user, { allowWhenSubscriptionExpired: subscriptionExpired });
	const searchParams = useSearchParams();

	useEffect(() => {
		if (searchParams.get('scroll') !== 'plans' || !showSubscription) return;
		const timer = window.setTimeout(() => {
			document.getElementById('subscription-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 350);
		return () => window.clearTimeout(timer);
	}, [searchParams, showSubscription]);

	const prefImageUrl =
		prefs?.profile?.image_url ??
		prefs?.profile?.imageUrl ??
		prefs?.profile_image_url ??
		prefs?.profileImageUrl ??
		null;

	useEffect(() => {
		if (!prefImageUrl) return;
		// Best-effort: if server has an image URL, use it unless user is previewing a new one.
		if (!photoPreview && !pendingPhotoUrl) {
			setPhotoPreview(prefImageUrl);
		}
	}, [prefImageUrl, photoPreview, pendingPhotoUrl]);

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full min-h-full flex flex-col">
				{isMobile && subscriptionAlert ? (
					<Box className="max-w-4xl mx-auto w-full px-4 pt-4">{subscriptionAlert}</Box>
				) : null}

				{/* Cover + avatar + name */}
				<Box className="relative w-full">
					<Box
						className="h-40 sm:h-56 w-full bg-gray-200"
						sx={{
							// Avoid hard-depending on a static asset; use a theme-based cover that always renders.
							backgroundImage: (theme) =>
								`linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
							backgroundSize: 'cover',
							backgroundPosition: 'center'
						}}
					/>
					<Box className="max-w-4xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ duration: 0.2 }}
							className="flex flex-col sm:flex-row sm:items-end gap-4 pb-6"
						>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								aria-hidden
								onChange={handlePhotoChange}
							/>
							<Box className="relative shrink-0">
								<Tooltip title="Change photo">
									<Box
										component="span"
										className="relative cursor-pointer block"
										onClick={handlePhotoClick}
										sx={{
											'&:hover .profile-avatar-overlay': { opacity: 1 }
										}}
									>
										<Avatar
											src={displayPhoto}
											alt={displayName}
											sx={{
												width: 120,
												height: 120,
												border: 4,
												borderColor: 'background.paper',
												backgroundColor: 'primary.main'
											}}
										>
											{displayName.charAt(0).toUpperCase()}
										</Avatar>
										<Box
											className="profile-avatar-overlay absolute inset-0 rounded-full flex items-center justify-center transition-opacity"
											sx={{
												bgcolor: 'rgba(0,0,0,0.5)',
												opacity: 0,
												border: 4,
												borderColor: 'background.paper'
											}}
										>
											{uploading ? (
												<Box className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
											) : (
												<FuseSvgIcon size={36} sx={{ color: 'white' }}>heroicons-outline:camera</FuseSvgIcon>
											)}
										</Box>
									</Box>
								</Tooltip>
								{displayPhoto && (
									<Tooltip title="Remove photo">
										<IconButton
											size="small"
											onClick={handleRemovePhoto}
											sx={{
												position: 'absolute',
												left: 100,
												bottom: 0,
												bgcolor: 'error.main',
												color: 'error.contrastText',
												'&:hover': { bgcolor: 'error.dark' }
											}}
										>
											<FuseSvgIcon size={18}>heroicons-outline:trash</FuseSvgIcon>
										</IconButton>
									</Tooltip>
								)}
							</Box>
							<Box className="flex flex-col sm:pb-1">
								<Box className="flex items-center gap-2">
									<Typography
										variant="h4"
										fontWeight="bold"
										sx={{
											color: 'common.white',
											textShadow: '0 1px 3px rgba(0,0,0,0.35)'
										}}
									>
										{displayName}
									</Typography>
								</Box>
								<Typography color="text.secondary" className="mt-0.5 flex items-center gap-1.5">
									<FuseSvgIcon size={18} color="action">heroicons-outline:envelope</FuseSvgIcon>
									{email}
								</Typography>
								<Chip
									icon={<FuseSvgIcon size={16}>heroicons-outline:shield-check</FuseSvgIcon>}
									label={roles}
									size="small"
									sx={{ mt: 1, alignSelf: 'flex-start' }}
									variant="outlined"
								/>
							</Box>
						</motion.div>
					</Box>
				</Box>

				{/* Content */}
				<Box className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4">
					{!isMobile && subscriptionAlert}

					<Paper className="p-6 rounded-xl shadow-sm">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
							<Box className="flex items-center gap-2">
								<Box
									className="flex items-center justify-center rounded-lg shrink-0"
									sx={{ width: 40, height: 40, bgcolor: 'primary.main', color: 'primary.contrastText' }}
								>
									<FuseSvgIcon size={22}>heroicons-outline:identification</FuseSvgIcon>
								</Box>
								<Typography variant="h6" className="font-semibold">
									Account information
								</Typography>
							</Box>
							<Box className="flex flex-wrap gap-2">
								<Button
									component={NavLinkAdapter}
									to="/apps/profile/edit"
									variant="outlined"
									size="small"
									startIcon={<FuseSvgIcon size={18}>heroicons-outline:pencil-square</FuseSvgIcon>}
								>
									Edit profile
								</Button>
								<Button
									component={NavLinkAdapter}
									to="/apps/profile/change-password"
									variant="outlined"
									size="small"
									color="primary"
									startIcon={<FuseSvgIcon size={18}>heroicons-outline:key</FuseSvgIcon>}
								>
									Change password
								</Button>
							</Box>
						</div>
						<Box className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:user</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Display name</Typography>
									<Typography className="font-medium">{displayName}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:envelope</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Email</Typography>
									<Typography className="font-medium">{email}</Typography>
								</Box>
							</Box>
							{/* <Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:at-symbol</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Username</Typography>
									<Typography className="font-medium">{username}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:identification</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Staff ID</Typography>
									<Typography className="font-medium">{staffId}</Typography>
								</Box>
							</Box> */}
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:phone</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Phone</Typography>
									<Typography className="font-medium">{phone}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:building-office-2</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Branch</Typography>
									<Typography className="font-medium">{branch}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg sm:col-span-2" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:shield-check</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Role</Typography>
									<Typography className="font-medium">{role}</Typography>
								</Box>
							</Box>
						</Box>
					</Paper>

					{showSubscription ? <SubscriptionSection /> : null}

					{!isMerchantUser ? (
						<Paper className="p-6 rounded-xl shadow-sm">
							<div className="flex items-center gap-2 mb-5">
								<Box
									className="flex items-center justify-center rounded-lg shrink-0"
									sx={{ width: 40, height: 40, bgcolor: 'primary.main', color: 'primary.contrastText' }}
								>
									<FuseSvgIcon size={22}>heroicons-outline:chart-bar</FuseSvgIcon>
								</Box>
								<Typography variant="h6" className="font-semibold">
									Sales (MTD)
								</Typography>
							</div>
							<Box className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
									<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:receipt-percent</FuseSvgIcon>
									<Box>
										<Typography variant="caption" color="text.secondary">Transactions</Typography>
										<Typography className="font-medium">{Number(mtd?.transactionsCount ?? 0)}</Typography>
									</Box>
								</Box>
								<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
									<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:banknotes</FuseSvgIcon>
									<Box>
										<Typography variant="caption" color="text.secondary">Total sales</Typography>
										<Typography className="font-medium">
											{formatGhsCurrency(Number(mtd?.totalSales ?? 0), 2, 2)}
										</Typography>
									</Box>
								</Box>
							</Box>
						</Paper>
					) : null}

					<Paper className="p-6 rounded-xl shadow-sm">
						<div className="flex items-center gap-2 mb-5">
							<Box
								className="flex items-center justify-center rounded-lg shrink-0"
								sx={{ width: 40, height: 40, bgcolor: 'primary.main', color: 'primary.contrastText' }}
							>
								<FuseSvgIcon size={22}>heroicons-outline:building-office-2</FuseSvgIcon>
							</Box>
							<Typography variant="h6" className="font-semibold">
								Company
							</Typography>
						</div>
						<Box className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:building-office-2</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Company name</Typography>
									<Typography className="font-medium">{companyName}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:briefcase</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Industry</Typography>
									<Typography className="font-medium">{companyIndustry}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg sm:col-span-2" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:map-pin</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Address</Typography>
									<Typography className="font-medium">{companyAddress}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:phone</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Company phone</Typography>
									<Typography className="font-medium">{companyPhone}</Typography>
								</Box>
							</Box>
							<Box className="flex items-start gap-3 p-3 rounded-lg" sx={{ bgcolor: 'action.hover' }}>
								<FuseSvgIcon size={22} color="action" className="shrink-0 mt-0.5">heroicons-outline:envelope</FuseSvgIcon>
								<Box>
									<Typography variant="caption" color="text.secondary">Company email</Typography>
									<Typography className="font-medium">{companyEmail}</Typography>
								</Box>
							</Box>
						</Box>
					</Paper>
				</Box>
			</div>

			<Dialog
				open={Boolean(pendingPhotoUrl)}
				onClose={handleClosePreviewModal}
				maxWidth="sm"
				fullWidth
				PaperProps={{ className: 'rounded-xl' }}
			>
				<DialogTitle className="flex items-center gap-2">
					<FuseSvgIcon size={24}>heroicons-outline:photo</FuseSvgIcon>
					Preview profile photo
				</DialogTitle>
				<DialogContent>
					{uploadError && (
						<Alert severity="error" className="mb-4">
							{uploadError}
						</Alert>
					)}
					{pendingPhotoUrl && (
						<Box className="flex flex-col items-center gap-3 p-2">
							<Box
								component="img"
								src={pendingPhotoUrl}
								alt="Preview"
								className="max-h-96 w-auto object-contain rounded-lg"
								sx={{ maxWidth: '100%' }}
							/>
							<Typography variant="body2" color="text.secondary" className="text-center">
								Review your photo, then click Upload to save it to your profile.
							</Typography>
						</Box>
					)}
				</DialogContent>
				<DialogActions className="gap-2 px-6 pb-4">
					<Button
						variant="outlined"
						onClick={handleClosePreviewModal}
						disabled={uploading}
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:x-mark</FuseSvgIcon>}
					>
						Cancel
					</Button>
					<Button
						variant="contained"
						color="primary"
						onClick={handleUploadPhoto}
						disabled={uploading}
						startIcon={
							uploading ? (
								<FuseSvgIcon size={18}>heroicons-outline:arrow-path</FuseSvgIcon>
							) : (
								<FuseSvgIcon size={18}>heroicons-outline:arrow-up-tray</FuseSvgIcon>
							)
						}
					>
						{uploading ? 'Uploading…' : 'Upload'}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}

export default ProfileApp;
