'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseLoading from '@fuse/core/FuseLoading';
import useUser from '@auth/useUser';
import { canManageSubscription } from '@auth/permissions';
import { useGetCurrentSubscriptionQuery, useInitiatePaymentMutation, useLazyVerifyPaymentQuery } from '../../../billing/SubscriptionApi';
import { alpha, useTheme } from '@mui/material/styles';

const MOBILE_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];

type TabValue = 'card' | 'mobile';

export default function Payment() {
	const theme = useTheme();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: user, subscriptionExpired } = useUser();
	const checkoutSubscriptionId = searchParams.get('subscription_id');
	const checkoutAmountParam = searchParams.get('amount');
	const upgradeBonusDays = Number(searchParams.get('upgrade_bonus_days') || 0);
	const upgradeCreditGhs = searchParams.get('upgrade_credit_ghs');

	const canCheckout = canManageSubscription(user, { allowWhenSubscriptionExpired: subscriptionExpired });

	useEffect(() => {
		if (user != null && !canCheckout) {
			router.replace('/apps/profile');
		}
	}, [user, canCheckout, router]);

	if (user == null) return <FuseLoading />;
	if (!canCheckout) return <FuseLoading />;
	const { data: sub, isLoading: loadingSub } = useGetCurrentSubscriptionQuery();
	const [initiatePayment, { isLoading: initiating }] = useInitiatePaymentMutation();
	const [verifyPayment, { isFetching: verifying }] = useLazyVerifyPaymentQuery();
	const [tab, setTab] = useState<TabValue>('mobile');
	const [phone, setPhone] = useState('');
	const [phoneError, setPhoneError] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [network, setNetwork] = useState('');
	const [mobileStep, setMobileStep] = useState<'form' | 'pending' | 'success'>('form');
	const [paymentReference, setPaymentReference] = useState<string | null>(null);

	// useEffect(() => {
	// 	if (mobileStep !== 'pending') return;
	// 	const t = setTimeout(() => setMobileStep('success'), 4000);
	// 	return () => clearTimeout(t);
	// }, [mobileStep]);

	const amount =
		checkoutAmountParam != null && checkoutAmountParam !== ''
			? Number(checkoutAmountParam) || 0
			: Number(sub?.subscription?.amount ?? 0) || 0;
	const currency = sub?.subscription?.currency ?? 'GHS';
	const subscriptionIdForPayment = checkoutSubscriptionId || sub?.subscription?.id;

	const handleCardPay = async () => {
		setSubmitError(null);
		try {
			const res = await initiatePayment({
				amount,
				payment_method: 'card',
				email: user?.email,
				subscription_id: subscriptionIdForPayment
			}).unwrap();
			const redirectUrl = res?.authorization_url || res?.data?.authorization_url || res?.data?.authorizationUrl;
			if (redirectUrl) {
				window.location.href = redirectUrl;
				return;
			}
			window.location.href = '/apps/profile/billing/payment/card';
		} catch (err: any) {
			setSubmitError(err?.data?.message || err?.data?.error || 'Could not initiate card payment. Please try again.');
		}
	};

	const handleMobileSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitError(null);
		const digitsOnly = phone.replace(/\D/g, '');
		if (digitsOnly.length !== 10 || !network) {
			setPhoneError('Phone number must be exactly 10 digits.');
			return;
		}
		setPhoneError(null);
		try {
			setMobileStep('pending');
			const res = await initiatePayment({
				amount,
				payment_method: 'mobile_money',
				email: user?.email,
				phone: digitsOnly,
				provider: network,
				subscription_id: subscriptionIdForPayment
			}).unwrap();
			if (res?.transaction_ref) {
				setPaymentReference(res.transaction_ref);
				setMobileStep('pending');
			} else {
				setMobileStep('form');
				setSubmitError(res?.message || 'Could not initiate mobile money payment. Please try again.');
			}
		} catch (err: any) {
			setMobileStep('form');
			setSubmitError(err?.data?.message || err?.data?.error || 'Could not initiate mobile money payment. Please try again.');
		}
	};

	const handleCheckStatus = () => {
		if (!paymentReference) {
			setSubmitError('Missing payment reference. Please initiate payment again.');
			return;
		}
		setSubmitError(null);
		verifyPayment(paymentReference)
			.unwrap()
			.then((res: any) => {
				const status = String(res?.status || '').toLowerCase();
				if (status === 'success' || status === 'completed') {
					setMobileStep('success');
					return;
				}
				if (status === 'failed' || status === 'error') {
					setMobileStep('form');
					setSubmitError('Payment failed. Please try again.');
					return;
				}
				setMobileStep('pending');
				setSubmitError('Payment is still pending. Please approve on your phone and check again.');
			})
			.catch((err: any) => {
				setSubmitError(err?.data?.message || err?.data?.error || 'Unable to verify payment right now. Please try again.');
			});
	};

	const handlePhoneChange = (value: string) => {
		const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
		setPhone(digitsOnly);
		if (phoneError && digitsOnly.length === 10) {
			setPhoneError(null);
		}
	};

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="mx-auto w-full max-w-5xl min-h-full px-4 py-8">
				{upgradeBonusDays > 0 ? (
					<Alert severity="info" className="mb-4">
						Plan upgrade: about {upgradeBonusDays} extra day{upgradeBonusDays === 1 ? '' : 's'} will be added to your
						new billing period
						{upgradeCreditGhs ? ` (≈ GHS ${upgradeCreditGhs} credit from remaining time on your previous plan)` : ''}.
					</Alert>
				) : null}
				{/* <Paper
					elevation={0}
					className="mb-6 overflow-hidden rounded-2xl"
					sx={{
						background:
							theme.palette.mode === 'dark'
								? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.12)} 100%)`
								: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
						border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
					}}
				>
					<Box className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
						<Box className="flex items-start gap-3">
							<Box
								className="flex items-center justify-center rounded-xl shrink-0"
								sx={{ width: 52, height: 52, bgcolor: 'primary.main', color: 'primary.contrastText' }}
							>
								<FuseSvgIcon size={26}>heroicons-outline:credit-card</FuseSvgIcon>
							</Box>
							<Box>
								<Typography variant="h4" className="font-bold">
									Complete your payment
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Secure checkout for your subscription plan
								</Typography>
							</Box>
						</Box>
						<Button
							component={NavLinkAdapter}
							to="/apps/profile"
							variant="outlined"
							size="small"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
						>
							Back
						</Button>
					</Box>
				</Paper> */}

				<div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
					<Paper variant="outlined" className="rounded-xl p-6 sm:p-8" sx={{ borderColor: 'divider' }}>
						<Typography variant="subtitle2" color="text.secondary" fontWeight={600} className="mb-2">
							Step 1 of 2
						</Typography>
						<Typography variant="h6" fontWeight={700} className="mb-4">
							Choose payment method
						</Typography>
						{submitError ? (
							<Alert severity="error" className="mb-4">
								{submitError}
							</Alert>
						) : null}
						<Box className="flex flex-col gap-2 mb-5">
							<Box
								component="button"
								type="button"
								onClick={() => { setTab('mobile'); setMobileStep('form'); }}
								className="flex items-center gap-3 w-full p-3 rounded-lg border transition-all outline-none cursor-pointer text-left"
								sx={{
									borderColor: tab === 'mobile' ? 'primary.main' : 'divider',
									bgcolor: tab === 'mobile' ? 'action.selected' : 'transparent',
									'&:hover': { bgcolor: tab === 'mobile' ? 'action.selected' : 'action.hover' }
								}}
							>
								<Box
									className="flex items-center justify-center rounded-full shrink-0"
									sx={{
										width: 44,
										height: 44,
										bgcolor: tab === 'mobile' ? 'primary.main' : 'action.hover',
										color: tab === 'mobile' ? 'primary.contrastText' : 'text.secondary'
									}}
								>
									<FuseSvgIcon size={22}>heroicons-outline:device-phone-mobile</FuseSvgIcon>
								</Box>
								<Box className="flex-1 min-w-0">
									<Typography variant="subtitle1" fontWeight="600">
										Mobile money
									</Typography>
									<Typography variant="caption" color="text.secondary">
										MTN, Telecel, AirtelTigo — pay from your phone
									</Typography>
								</Box>
								<Box
									className="shrink-0 rounded-full border-2"
									sx={{
										width: 22,
										height: 22,
										borderColor: tab === 'mobile' ? 'primary.main' : 'divider',
										bgcolor: tab === 'mobile' ? 'primary.main' : 'transparent'
									}}
								/>
							</Box>
							<Box
								component="button"
								type="button"
								onClick={() => setTab('card')}
								className="flex items-center gap-3 w-full p-3 rounded-lg border transition-all outline-none cursor-pointer text-left"
								sx={{
									borderColor: tab === 'card' ? 'primary.main' : 'divider',
									bgcolor: tab === 'card' ? 'action.selected' : 'transparent',
									'&:hover': { bgcolor: tab === 'card' ? 'action.selected' : 'action.hover' }
								}}
							>
								<Box
									className="flex items-center justify-center rounded-full shrink-0"
									sx={{
										width: 44,
										height: 44,
										bgcolor: tab === 'card' ? 'primary.main' : 'action.hover',
										color: tab === 'card' ? 'primary.contrastText' : 'text.secondary'
									}}
								>
									<FuseSvgIcon size={22}>heroicons-outline:credit-card</FuseSvgIcon>
								</Box>
								<Box className="flex-1 min-w-0">
									<Typography variant="subtitle1" fontWeight="600">
										Card
									</Typography>
									<Typography variant="caption" color="text.secondary">
										Visa, Mastercard — redirect to secure page
									</Typography>
								</Box>
								<Box
									className="shrink-0 rounded-full border-2"
									sx={{
										width: 22,
										height: 22,
										borderColor: tab === 'card' ? 'primary.main' : 'divider',
										bgcolor: tab === 'card' ? 'primary.main' : 'transparent'
									}}
								/>
							</Box>
						</Box>
						<Divider className="mb-5" />

						{tab === 'card' && (
							<Box>
								<Chip size="small" label="Recommended for faster confirmation" color="info" className="mb-3" />
								<Typography variant="body2" color="text.secondary" className="mb-4">
									You will be redirected to our secure payment page to complete your card payment.
								</Typography>
								<Button
									variant="contained"
									color="primary"
									fullWidth
									size="large"
									onClick={handleCardPay}
									disabled={initiating || loadingSub}
									startIcon={<FuseSvgIcon size={20}>heroicons-outline:credit-card</FuseSvgIcon>}
								>
									Pay with card
								</Button>
							</Box>
						)}

						{tab === 'mobile' && (
							<>
								{mobileStep === 'form' && (
									<form onSubmit={handleMobileSubmit} className="flex flex-col gap-0">
										<Box className="flex items-center gap-2 mb-3">
											<FuseSvgIcon size={20} color="primary">heroicons-outline:device-phone-mobile</FuseSvgIcon>
											<Typography variant="subtitle2" fontWeight="600" color="text.secondary">
												Step 2: Mobile money details
											</Typography>
										</Box>
										<Box
											className="flex flex-col gap-4 p-4 rounded-xl mb-4"
											sx={{ bgcolor: 'action.hover', border: 1, borderColor: 'divider' }}
										>
											<TextField
												label="Phone number"
												value={phone}
												onChange={(e) => handlePhoneChange(e.target.value)}
												fullWidth
												variant="outlined"
												size="medium"
												placeholder="e.g. 0241234567"
												error={Boolean(phoneError)}
												helperText={phoneError ?? 'Enter exactly 10 digits linked to your mobile money account'}
												required
												inputProps={{
													inputMode: 'numeric',
													pattern: '[0-9]*',
													maxLength: 10
												}}
												sx={{
													'& .MuiOutlinedInput-root': {
														bgcolor: 'background.paper',
														borderRadius: 2,
														'&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
														'&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 }
													}
												}}
												InputProps={{
													startAdornment: (
														<InputAdornment position="start" sx={{ ml: 0.5 }}>
															<FuseSvgIcon size={22} color="action">heroicons-outline:phone</FuseSvgIcon>
														</InputAdornment>
													)
												}}
											/>
											<TextField
												select
												label="Mobile network"
												value={network}
												onChange={(e) => setNetwork(e.target.value)}
												fullWidth
												variant="outlined"
												size="medium"
												helperText="Select your mobile money provider"
												required
												SelectProps={{
													MenuProps: {
														PaperProps: { sx: { borderRadius: 2, mt: 1.5 } },
														anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
														transformOrigin: { vertical: 'top', horizontal: 'left' }
													}
												}}
												sx={{
													'& .MuiOutlinedInput-root': {
														bgcolor: 'background.paper',
														borderRadius: 2,
														'&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
														'&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 }
													}
												}}
												InputProps={{
													startAdornment: (
														<InputAdornment position="start" sx={{ ml: 0.5 }}>
															<FuseSvgIcon size={22} color="action">heroicons-outline:signal</FuseSvgIcon>
														</InputAdornment>
													)
												}}
											>
												{MOBILE_NETWORKS.map((n) => (
													<MenuItem key={n} value={n}>
														<Box className="flex items-center gap-2">
															{/* <FuseSvgIcon size={18} color="action">heroicons-outline:signal</FuseSvgIcon> */}
															{n}
														</Box>
													</MenuItem>
												))}
											</TextField>
										</Box>
										<Button
											type="submit"
											variant="contained"
											color="primary"
											fullWidth
											size="large"
											startIcon={<FuseSvgIcon size={20}>heroicons-outline:paper-airplane</FuseSvgIcon>}
											disabled={initiating || loadingSub}
										>
											Initiate payment
										</Button>
									</form>
								)}
								{mobileStep === 'pending' && (
									<Box className="py-8 flex flex-col items-center gap-4 text-center">
										<CircularProgress size={48} />
										<Typography fontWeight="500">Waiting for payment confirmation…</Typography>
										<Typography variant="body2" color="text.secondary">
											Check your phone and approve the payment. If confirmation is delayed, use the button below to check status.
										</Typography>
										<Button
											variant="outlined"
											color="primary"
											onClick={handleCheckStatus}
											disabled={verifying}
											startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-path</FuseSvgIcon>}
										>
											{verifying ? 'Checking...' : 'Check status'}
										</Button>
									</Box>
								)}
								{mobileStep === 'success' && (
									<Box className="py-8 flex flex-col items-center gap-4 text-center">
										<Box
											className="flex items-center justify-center rounded-full w-16 h-16"
											sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}
										>
											<FuseSvgIcon size={40}>heroicons-outline:check</FuseSvgIcon>
										</Box>
										<Typography variant="h6" fontWeight="600">Payment successful</Typography>
										<Typography variant="body2" color="text.secondary">
											Your payment of {currency} {amount} has been completed.
										</Typography>
										<Button
											variant="contained"
											color="primary"
											onClick={() => router.push('/apps/profile')}
											startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
										>
											Back to profile
										</Button>
									</Box>
								)}
							</>
						)}
					</Paper>

					<Paper variant="outlined" className="rounded-xl p-6" sx={{ borderColor: 'divider', height: 'fit-content' }}>
						<Typography variant="subtitle2" color="text.secondary" fontWeight={600} className="mb-2">
							Order summary
						</Typography>
						<Typography variant="h6" fontWeight={700} className="mb-4">
							Subscription charge
						</Typography>
						{loadingSub ? (
							<FuseLoading />
						) : (
							<>
								<Box className="mb-3 flex items-center justify-between">
									<Typography color="text.secondary">Plan amount</Typography>
									<Typography fontWeight={600}>{currency} {amount.toFixed(2)}</Typography>
								</Box>
								<Box className="mb-3 flex items-center justify-between">
									<Typography color="text.secondary">Payment method</Typography>
									<Typography fontWeight={600}>{tab === 'mobile' ? 'Mobile money' : 'Card'}</Typography>
								</Box>
								<Divider className="my-3" />
								<Box className="flex items-center justify-between">
									<Typography fontWeight={700}>Total due now</Typography>
									<Typography variant="h6" fontWeight={800}>{currency} {amount.toFixed(2)}</Typography>
								</Box>
							</>
						)}
						<Alert severity="info" className="mt-4">
							Payments are processed securely. You can verify status from Subscription after checkout.
						</Alert>
					</Paper>
				</div>
			</div>
		</>
	);
}
