'use client';

import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useUser from '@auth/useUser';
import FuseLoading from '@fuse/core/FuseLoading';
import { hasPermissionCodes } from '@auth/permissions';
import { useGetCompanyProfileQuery, isCompanyProfileSet } from 'src/app/(control-panel)/company-profile/CompanyProfileApi';

function NoAppAccessYet() {
	const theme = useTheme();
	const { signOut } = useUser();

	return (
		<Box
			className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8"
			sx={{
				position: 'relative',
				overflow: 'hidden',
				background:
					theme.palette.mode === 'dark'
						? `linear-gradient(165deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.dark, 0.35)} 45%, ${theme.palette.background.default} 100%)`
						: `linear-gradient(165deg, ${alpha(theme.palette.primary.light, 0.12)} 0%, ${theme.palette.background.default} 42%, ${alpha(theme.palette.secondary?.main ?? theme.palette.primary.main, 0.06)} 100%)`,
				'&::before': {
					content: '""',
					position: 'absolute',
					inset: 0,
					background:
						'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(33, 150, 243, 0.18), transparent 55%)',
					pointerEvents: 'none'
				}
			}}
		>
			<Paper
				elevation={0}
				className="relative w-full max-w-[440px] overflow-hidden rounded-2xl"
				sx={{
					border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.14 : 0.9)}`,
					boxShadow:
						theme.palette.mode === 'dark'
							? `0 24px 80px -24px ${alpha('#000', 0.65)}, 0 0 0 1px ${alpha(theme.palette.common.white, 0.06)} inset`
							: `0 25px 50px -12px ${alpha(theme.palette.primary.main, 0.12)}, 0 12px 24px -8px ${alpha('#000', 0.08)}`
				}}
			>
				<Box
					className="h-1 w-full"
					sx={{
						background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
					}}
				/>
				<Box className="px-8 pb-8 pt-7 sm:px-10 sm:pb-10 sm:pt-8">
					<Stack direction="row" alignItems="center" spacing={2} className="mb-8">
						<Box
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm"
							sx={{
								background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.primary.main, 0.04)})`,
								border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
							}}
						>
							<img
								src="/assets/images/logo/ims.svg"
								alt=""
								className="h-7 w-7"
								width={28}
								height={28}
							/>
						</Box>
						<Box>
							<Typography
								className="text-2xl font-semibold leading-tight tracking-tight"
								sx={{ color: 'text.primary' }}
							>
								Shopynn
							</Typography>
							<Typography variant="caption" color="text.secondary" className="tracking-wide">
								Inventory Management
							</Typography>
						</Box>
					</Stack>

					<Stack direction="row" spacing={2} alignItems="flex-start" className="mb-6">
						<Box
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
							sx={{
								backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
								color: theme.palette.warning.main
							}}
						>
							<FuseSvgIcon size={22}>heroicons-outline:shield-exclamation</FuseSvgIcon>
						</Box>
						<Box>
							<Typography variant="overline" color="text.secondary" className="mb-0.5 block font-semibold">
								Account active · access pending
							</Typography>
							<Typography variant="h5" component="h1" fontWeight={700} className="leading-snug tracking-tight">
								No workspace access yet
							</Typography>
						</Box>
					</Stack>

					<Typography color="text.secondary" className="mb-8 text-[0.95rem] leading-relaxed">
						You&apos;re signed in, but no features are unlocked for your account. An administrator needs to assign a
						role or the right permissions before you can use Shopynn.
					</Typography>

					<Stack spacing={2} className="mb-8">
						{[
							{
								icon: 'heroicons-outline:user-group' as const,
								text: 'Ask your admin to review your user role and permissions.'
							},
							{
								icon: 'heroicons-outline:key' as const,
								text: 'Each area of the app (sales, inventory, settings, etc.) requires its own access.'
							},
							{
								icon: 'heroicons-outline:envelope' as const,
								text: "If you believe this is a mistake, contact your organization's IT or manager."
							}
						].map((row) => (
							<Stack key={row.icon} direction="row" spacing={2} alignItems="flex-start">
								<Box
									className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
									sx={{
										backgroundColor: alpha(theme.palette.primary.main, 0.08),
										color: 'primary.main'
									}}
								>
									<FuseSvgIcon size={18}>{row.icon}</FuseSvgIcon>
								</Box>
								<Typography variant="body2" color="text.secondary" className="leading-relaxed">
									{row.text}
								</Typography>
							</Stack>
						))}
					</Stack>

					<Divider className="mb-6" sx={{ borderColor: alpha(theme.palette.divider, 0.6) }} />

					<Button
						fullWidth
						size="large"
						variant="contained"
						color="primary"
						onClick={() => signOut({ callbackUrl: '/sign-in' })}
						startIcon={<FuseSvgIcon size={20}>heroicons-outline:arrow-right-on-rectangle</FuseSvgIcon>}
						sx={{
							py: 1.25,
							borderRadius: 2,
							textTransform: 'none',
							fontWeight: 600,
							boxShadow: `0 8px 24px -8px ${alpha(theme.palette.primary.main, 0.55)}`
						}}
					>
						Sign out and return to login
					</Button>
				</Box>
			</Paper>

			<Typography variant="caption" color="text.secondary" className="relative mt-8 text-center opacity-70">
				© Shopynn · Secure sign-in
			</Typography>
		</Box>
	);
}

function MainPage() {
	const { data: user, isGuest, subscriptionExpired } = useUser();
	const { data: companyProfile, isLoading: profileLoading } = useGetCompanyProfileQuery(undefined, {
		skip: isGuest
	});

	if (isGuest) {
		redirect('/sign-in');
	}

	if (subscriptionExpired) {
		redirect('/apps/profile');
	}

	// Wait for profile check when authenticated
	if (profileLoading) {
		return <FuseLoading />;
	}

	// Redirect to company profile if not set (authenticated users only)
	if (!isCompanyProfileSet(companyProfile)) {
		redirect('/company-profile');
	}

	// Permission-based home (matches AuthGuardRedirect / sign-in default — do not gate only on `role`).
	if (hasPermissionCodes(user, 'dashboard.view')) {
		redirect('/dashboards/analytics');
	}
	if (hasPermissionCodes(user, ['merchants.operate', 'merchants.view'])) {
		redirect('/merchants');
	}
	if (hasPermissionCodes(user, 'sales.view')) {
		redirect('/trading/newsale');
	}
	if (hasPermissionCodes(user, 'purchases.view')) {
		redirect('/trading/newpurchase');
	}
	if (hasPermissionCodes(user, 'inventory.view')) {
		redirect('/inventory/products');
	}
	if (hasPermissionCodes(user, 'settings.view')) {
		redirect('/apps/settings/account');
	}

	return <NoAppAccessYet />;
}

export default MainPage;
