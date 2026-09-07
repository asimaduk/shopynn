'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import FuseLoading from '@fuse/core/FuseLoading';
import Link from '@fuse/core/Link';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetUserQuery, type SystemUser } from '../../../../apps/settings/users/UsersApi';

function roleLabel(user: SystemUser) {
	const names = user.roles?.map((r) => r.name).filter(Boolean).join(', ');
	if (names) return names;
	return user.user_type === 1 ? 'Administrator' : 'Staff';
}

function formatWhen(iso?: string) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch {
		return iso;
	}
}

function userIsDeleted(u: SystemUser): boolean {
	if (u.deleted === true) return true;
	const v = u.deleted as unknown;
	if (v === 1 || v === '1') return true;
	if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
	const alt = (u as unknown as { is_deleted?: boolean }).is_deleted;
	return alt === true;
}

function initialsFromName(first?: string, last?: string): string {
	const a = (first || '').trim().charAt(0);
	const b = (last || '').trim().charAt(0);
	const s = `${a}${b}`.toUpperCase();
	return s || '?';
}

type FieldProps = {
	icon: string;
	label: string;
	children: ReactNode;
};

function ProfileField({ icon, label, children }: FieldProps) {
	return (
		<Stack
			direction="row"
			spacing={2}
			alignItems="flex-start"
			sx={{
				p: 2,
				borderRadius: 2,
				border: '1px solid',
				borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
				bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04)
			}}
		>
			<Box
				sx={{
					width: 40,
					height: 40,
					borderRadius: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					flexShrink: 0,
					bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
					color: 'primary.main'
				}}
			>
				<FuseSvgIcon size={22}>{icon}</FuseSvgIcon>
			</Box>
			<Box sx={{ minWidth: 0, flex: 1 }}>
				<Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
					{label}
				</Typography>
				<Box sx={{ mt: 0.5 }}>{children}</Box>
			</Box>
		</Stack>
	);
}

type SectionCardProps = {
	title: string;
	icon: string;
	children: ReactNode;
};

function SectionCard({ title, icon, children }: SectionCardProps) {
	return (
		<Paper
			elevation={0}
			variant="outlined"
			sx={{
				borderRadius: 3,
				overflow: 'hidden',
				borderColor: 'divider'
			}}
		>
			<Box
				className="flex items-center gap-2 px-4 py-3"
				sx={{
					borderBottom: '1px solid',
					borderColor: 'divider',
					bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.8)
				}}
			>
				<FuseSvgIcon size={22} color="action">
					{icon}
				</FuseSvgIcon>
				<Typography variant="subtitle1" fontWeight={700}>
					{title}
				</Typography>
			</Box>
			<Box className="p-4">{children}</Box>
		</Paper>
	);
}

export default function ViewUserPage() {
	const params = useParams<{ userId: string }>();
	const userId = params?.userId;

	const { data: user, isLoading, isError } = useGetUserQuery(userId ?? '', {
		skip: !userId
	});

	if (!userId) {
		return (
			<div className="px-4 py-8">
				<Typography color="text.secondary">Missing user id.</Typography>
			</div>
		);
	}

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError || !user) {
		return (
			<Box className="px-4 py-12 max-w-lg mx-auto text-center">
				<PageBreadcrumb className="mb-6 text-left" />
				<Paper variant="outlined" className="p-8 rounded-3xl" sx={{ borderColor: 'divider' }}>
					<Box
						className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.12), color: 'error.main' }}
					>
						<FuseSvgIcon size={32}>heroicons-outline:exclamation-circle</FuseSvgIcon>
					</Box>
					<Typography variant="h6" fontWeight={700} gutterBottom>
						User could not be loaded
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mb-6">
						Check the link or try again from the user list.
					</Typography>
					<Button
						variant="contained"
						color="secondary"
						component={Link}
						to="/users/staff"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to users
					</Button>
				</Paper>
			</Box>
		);
	}

	const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';
	const isDeleted = userIsDeleted(user);

	return (
		<div className="w-full min-h-full pb-12">
			<Box
				className="px-4 sm:px-6 lg:px-10 pt-6 pb-10"
				sx={{
					background: (theme) =>
						`linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.08)} 0%, transparent 72%)`
				}}
			>
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
					className="max-w-4xl mx-auto"
				>
					<PageBreadcrumb className="mb-4" />

					<Paper
						elevation={0}
						sx={{
							borderRadius: 4,
							overflow: 'hidden',
							border: '1px solid',
							borderColor: 'divider',
							bgcolor: 'background.paper',
							boxShadow: (theme) =>
								theme.palette.mode === 'dark'
									? `0 24px 48px ${alpha('#000', 0.35)}`
									: `0 20px 40px ${alpha(theme.palette.common.black, 0.06)}, 0 0 1px ${alpha(theme.palette.common.black, 0.08)}`
						}}
					>
						{/* Hero */}
						<Box
							className="relative px-6 py-8 sm:px-8 sm:py-10"
							sx={{
								background: (theme) =>
									`linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`
							}}
						>
							<Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
								<Stack direction="row" spacing={2.5} alignItems="center">
									<Avatar
										sx={{
											width: 72,
											height: 72,
											fontSize: '1.5rem',
											fontWeight: 800,
											bgcolor: 'primary.main',
											color: 'primary.contrastText',
											boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`
										}}
									>
										{initialsFromName(user.first_name, user.last_name)}
									</Avatar>
									<Box>
										<Typography className="text-2xl sm:text-3xl font-extrabold tracking-tight" component="h1">
											{fullName}
										</Typography>
										<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
											Staff profile · {roleLabel(user)}
										</Typography>
										<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
											{isDeleted && <Chip label="Deleted" color="error" size="small" />}
											{!isDeleted &&
												(user.is_active !== false ? (
													<Chip label="Active" color="success" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
												) : (
													<Chip label="Inactive" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
												))}
										</Stack>
									</Box>
								</Stack>

								<Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
									<Button
										variant="outlined"
										component={Link}
										to="/users/staff"
										size="medium"
										sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
									>
										Users
									</Button>
									<Button
										variant="contained"
										color="secondary"
										component={Link}
										to={`/trading/sales?soldBy=${encodeURIComponent(user.id)}&soldByName=${encodeURIComponent(fullName)}`}
										size="medium"
										sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:shopping-cart</FuseSvgIcon>}
									>
										Sales
									</Button>
									{!isDeleted && (
										<Button
											variant="contained"
											color="primary"
											component={Link}
											to={`/users/staff/${user.id}`}
											size="medium"
											sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
											startIcon={<FuseSvgIcon size={18}>heroicons-outline:pencil-square</FuseSvgIcon>}
										>
											Edit
										</Button>
									)}
								</Stack>
							</Stack>
						</Box>

						{/* Body */}
						<Box className="px-4 py-6 sm:px-8 sm:pb-8 space-y-6">
							<SectionCard title="Contact" icon="heroicons-outline:envelope">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<ProfileField icon="heroicons-outline:envelope" label="Email">
										<Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
											{user.email || '—'}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:phone" label="Phone">
										<Typography variant="body1" fontWeight={600}>
											{user.phone || '—'}
										</Typography>
									</ProfileField>
								</div>
							</SectionCard>

							<SectionCard title="Assignment" icon="heroicons-outline:building-office-2">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<ProfileField icon="heroicons-outline:shield-check" label="Role">
										<Typography variant="body1" fontWeight={600}>
											{roleLabel(user)}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:cube" label="Warehouse">
										<Typography variant="body1" fontWeight={600}>
											{user.warehouse_name || '—'}
										</Typography>
									</ProfileField>
								</div>
							</SectionCard>

							<SectionCard title="Activity & account" icon="heroicons-outline:clock">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<ProfileField icon="heroicons-outline:arrow-right-on-rectangle" label="Last login">
										<Typography variant="body1" fontWeight={600}>
											{user.last_login ? formatWhen(user.last_login) : '—'}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:calendar" label="Created">
										<Typography variant="body1" fontWeight={600}>
											{formatWhen(user.created_at)}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:arrow-path" label="Last updated">
										<Typography variant="body1" fontWeight={600}>
											{formatWhen(user.updated_at)}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:trash" label="Deleted at">
										<Typography variant="body1" fontWeight={600}>
											{user.deleted_at ? formatWhen(user.deleted_at) : '—'}
										</Typography>
									</ProfileField>
								</div>
							</SectionCard>
						</Box>
					</Paper>
				</motion.div>
			</Box>
		</div>
	);
}
