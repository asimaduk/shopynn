'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import { alpha, useTheme } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import { motion } from 'motion/react';
import useUser from '@auth/useUser';
import { hasPermissionCodes } from '@auth/permissions';
import toast from 'react-hot-toast';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetAdminMerchantDetailQuery, useMarkCommissionPaidMutation } from './MerchantApi';
import { formatDate, formatMoney, userDisplayName } from './merchantFormatters';
import SwitchServingMerchantDialog from '../tenants-directory/SwitchServingMerchantDialog';

function initialsFromName(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	if (parts.length === 1 && parts[0].length) return parts[0].slice(0, 2).toUpperCase();
	return '?';
}

type MerchantDetailPageProps = {
	merchantId: string;
};

export default function MerchantDetailPage({ merchantId }: MerchantDetailPageProps) {
	const theme = useTheme();
	const { data: user } = useUser();
	const canMarkCommissionsPaid = hasPermissionCodes(user, 'merchants.view');

	const { data, isFetching, isError, refetch } = useGetAdminMerchantDetailQuery(merchantId, {
		skip: !merchantId,
		refetchOnMountOrArgChange: true
	});

	const [markPaid, { isLoading: marking }] = useMarkCommissionPaidMutation();
	const [switchTenant, setSwitchTenant] = useState<{ id: string; name: string | null } | null>(null);

	const merchant = data?.merchant;
	const tenants = data?.tenants ?? [];
	const commissions = data?.commissions ?? [];
	const pendingCount = commissions.filter((c) => c.status === 'pending').length;
	const displayName = merchant ? userDisplayName(merchant) : '';

	const handleMarkPaid = async (commissionId: string) => {
		try {
			await markPaid(commissionId).unwrap();
			toast.success('Marked paid.');
			await refetch();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; error?: string };
			toast.error(err?.data?.message || err?.error || 'Update failed');
		}
	};

	if (!merchantId) {
		return (
			<Container maxWidth="lg" className="py-8">
				<PageBreadcrumb className="mb-4" />
				<Typography color="text.secondary">Missing merchant id.</Typography>
				<Button className="mt-4" component={Link} to="/merchants" variant="outlined" startIcon={<FuseSvgIcon>heroicons-outline:arrow-left</FuseSvgIcon>}>
					Back to merchants
				</Button>
			</Container>
		);
	}

	return (
		<Box className="min-h-[480px] pb-16">
			<Container maxWidth="lg" className="pt-4">
				<PageBreadcrumb className="mb-4" />

				<Button
					component={Link}
					to="/merchants"
					color="secondary"
					className="mb-6"
					startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					size="small"
				>
					All merchants
				</Button>

				{isFetching ? (
					<Paper elevation={0} variant="outlined" className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl p-12">
						<FuseLoading />
						<Typography color="text.secondary" className="mt-4">
							Loading merchant…
						</Typography>
					</Paper>
				) : isError || !merchant ? (
					<Paper elevation={0} variant="outlined" className="rounded-2xl p-8">
						<Typography color="text.secondary" className="mb-4">
							Could not load this merchant. They may have been removed or you may not have access.
						</Typography>
						<Button component={Link} to="/merchants" variant="contained">
							Back to merchants
						</Button>
					</Paper>
				) : (
					<>
						<Paper
							elevation={0}
							className="mb-8 overflow-hidden rounded-2xl"
							sx={{
								border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
								background:
									theme.palette.mode === 'dark'
										? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`
										: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`
							}}
						>
							<Box className="flex flex-col gap-6 px-6 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-10">
								<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
									<Avatar
										sx={{
											width: 72,
											height: 72,
											fontSize: '1.5rem',
											fontWeight: 700,
											bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.2),
											color: theme.palette.primary.main,
											border: `2px solid ${alpha(theme.palette.common.white, 0.15)}`
										}}
									>
										{initialsFromName(displayName)}
									</Avatar>
									<Box className="min-w-0 flex-1">
										<Typography variant="overline" className="mb-0.5 font-semibold tracking-widest" sx={{ color: 'primary.main' }}>
											Field agent
										</Typography>
										<Typography variant="h4" className="font-bold tracking-tight">
											{displayName}
										</Typography>
										<Typography variant="body1" color="text.secondary" className="mt-1">
											{merchant.email ?? '—'}
											{' · '}
											{merchant.phone ?? '—'}
										</Typography>
									</Box>
								</motion.div>

								<Stack direction="row" flexWrap="wrap" gap={1} className="shrink-0 sm:pt-1">
									<Chip
										label={`${tenants.length} ${tenants.length === 1 ? 'business' : 'businesses'}`}
										size="medium"
										variant="outlined"
										icon={<FuseSvgIcon size={18}>heroicons-outline:building-storefront</FuseSvgIcon>}
										sx={{ fontWeight: 600, borderColor: alpha(theme.palette.divider, 0.8) }}
									/>
									<Chip
										label={`${commissions.length} commission${commissions.length === 1 ? '' : 's'}`}
										size="medium"
										variant="outlined"
										icon={<FuseSvgIcon size={18}>heroicons-outline:banknotes</FuseSvgIcon>}
										sx={{ fontWeight: 600, borderColor: alpha(theme.palette.divider, 0.8) }}
									/>
									{pendingCount > 0 ? (
										<Chip
											label={`${pendingCount} pending`}
											size="medium"
											color="warning"
											variant="outlined"
											sx={{ fontWeight: 600 }}
										/>
									) : null}
								</Stack>
							</Box>

							<Divider />

							<Box className="grid gap-4 px-6 py-5 sm:grid-cols-2 sm:px-8">
								<Box>
									<Typography variant="caption" color="text.secondary" className="font-semibold uppercase tracking-wide">
										Default commission
									</Typography>
									<Typography variant="h6" className="mt-0.5 font-semibold">
										{merchant.default_commission_percent != null && merchant.default_commission_percent !== ''
											? `${formatMoney(merchant.default_commission_percent)}%`
											: '—'}
									</Typography>
								</Box>
								<Box>
									<Typography variant="caption" color="text.secondary" className="font-semibold uppercase tracking-wide">
										Registered
									</Typography>
									<Typography variant="h6" className="mt-0.5 font-semibold">
										{formatDate(merchant.created_at)}
									</Typography>
								</Box>
							</Box>
						</Paper>

						<Stack spacing={4}>
							<Box>
								<Typography variant="h6" className="mb-3 font-bold">
									Onboarded businesses
								</Typography>
								<TableContainer component={Paper} variant="outlined" className="rounded-xl shadow-none">
									<Table size="small">
										<TableHead>
											<TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
												<TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
												<TableCell sx={{ fontWeight: 700 }}>Organization</TableCell>
												<TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
												<TableCell sx={{ fontWeight: 700 }}>Subscription</TableCell>
												<TableCell sx={{ fontWeight: 700 }}>Serving</TableCell>
												<TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
												<TableCell align="right" sx={{ fontWeight: 700 }}>
													Actions
												</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{tenants.length === 0 ? (
												<TableRow>
													<TableCell colSpan={7}>
														<Typography color="text.secondary" className="py-4 text-center">
															No businesses linked yet.
														</Typography>
													</TableCell>
												</TableRow>
											) : (
												tenants.map((t) => (
													<TableRow key={t.id} hover>
														<TableCell>{t.name ?? '—'}</TableCell>
														<TableCell>{t.organization ?? '—'}</TableCell>
														<TableCell>{t.phone ?? '—'}</TableCell>
														<TableCell>
															{t.subscription_name ?? '—'}
															{t.subscription_amount != null
																? ` (₵${formatMoney(t.subscription_amount)})`
																: ''}
														</TableCell>
														<TableCell>
															{(t as { is_serving_agent?: boolean }).is_serving_agent ? (
																<Chip size="small" color="success" label="Yes" variant="outlined" />
															) : (
																<Chip size="small" label="No" variant="outlined" />
															)}
														</TableCell>
														<TableCell>{formatDate(t.created_at)}</TableCell>
														<TableCell align="right">
															<Button
																size="small"
																variant="outlined"
																onClick={() =>
																	setSwitchTenant({ id: t.id, name: t.name ?? null })
																}
															>
																Switch agent
															</Button>
														</TableCell>
													</TableRow>
												))
											)}
										</TableBody>
									</Table>
								</TableContainer>
							</Box>

							<Box>
								<Typography variant="h6" className="mb-3 font-bold">
									Commissions
								</Typography>
								<TableContainer component={Paper} variant="outlined" className="rounded-xl shadow-none">
									<Table size="small">
										<TableHead>
											<TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
												<TableCell sx={{ fontWeight: 700 }}>Business</TableCell>
												<TableCell align="right" sx={{ fontWeight: 700 }}>
													Base
												</TableCell>
												<TableCell align="right" sx={{ fontWeight: 700 }}>
													%
												</TableCell>
												<TableCell align="right" sx={{ fontWeight: 700 }}>
													Commission
												</TableCell>
												<TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
												<TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
												{canMarkCommissionsPaid ? (
													<TableCell align="right" sx={{ fontWeight: 700 }}>
														Actions
													</TableCell>
												) : null}
											</TableRow>
										</TableHead>
										<TableBody>
											{commissions.length === 0 ? (
												<TableRow>
													<TableCell colSpan={canMarkCommissionsPaid ? 7 : 6}>
														<Typography color="text.secondary" className="py-4 text-center">
															No commission rows yet.
														</Typography>
													</TableCell>
												</TableRow>
											) : (
												commissions.map((c) => (
													<TableRow key={c.id} hover>
														<TableCell>{c.tenant_name ?? c.tenant_id}</TableCell>
														<TableCell align="right">₵{formatMoney(c.base_amount)}</TableCell>
														<TableCell align="right">{formatMoney(c.commission_percent)}</TableCell>
														<TableCell align="right">₵{formatMoney(c.commission_amount)}</TableCell>
														<TableCell>
															<Chip
																size="small"
																label={c.status}
																color={c.status === 'paid' ? 'success' : 'warning'}
																variant={c.status === 'paid' ? 'filled' : 'outlined'}
															/>
														</TableCell>
														<TableCell>{formatDate(c.created_at)}</TableCell>
														{canMarkCommissionsPaid ? (
															<TableCell align="right">
																{c.status === 'pending' ? (
																	<Button size="small" disabled={marking} onClick={() => handleMarkPaid(c.id)} variant="outlined">
																		Mark paid
																	</Button>
																) : (
																	'—'
																)}
															</TableCell>
														) : null}
													</TableRow>
												))
											)}
										</TableBody>
									</Table>
								</TableContainer>
							</Box>
						</Stack>
					</>
				)}
			</Container>

			<SwitchServingMerchantDialog
				open={Boolean(switchTenant)}
				onClose={() => setSwitchTenant(null)}
				tenantId={switchTenant?.id ?? null}
				tenantName={switchTenant?.name}
				currentMerchantId={
					switchTenant
						? (tenants.find((t) => t.id === switchTenant.id)?.serving_merchant_id ??
							(tenants.find((t) => t.id === switchTenant.id)?.is_serving_agent ? merchantId : null))
						: null
				}
				onSaved={() => refetch()}
			/>
		</Box>
	);
}
