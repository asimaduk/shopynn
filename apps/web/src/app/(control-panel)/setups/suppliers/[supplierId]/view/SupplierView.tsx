'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import FuseLoading from '@fuse/core/FuseLoading';
import { useParams } from 'next/navigation';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetSupplierQuery, type Supplier } from '../../SupplierApi';

function initialsFromSupplierName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		const a = parts[0].charAt(0);
		const b = parts[parts.length - 1].charAt(0);
		return `${a}${b}`.toUpperCase();
	}
	if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
	return '?';
}

function formatDate(iso?: string): string {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	} catch {
		return iso;
	}
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
				<Typography
					variant="caption"
					color="text.secondary"
					fontWeight={600}
					sx={{ letterSpacing: 0.4, textTransform: 'uppercase' }}
				>
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
	headerExtra?: ReactNode;
};

function SectionCard({ title, icon, children, headerExtra }: SectionCardProps) {
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
				className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
				sx={{
					borderBottom: '1px solid',
					borderColor: 'divider',
					bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.8)
				}}
			>
				<Box className="flex items-center gap-2 min-w-0">
					<FuseSvgIcon size={22} color="action">
						{icon}
					</FuseSvgIcon>
					<Typography variant="subtitle1" fontWeight={700}>
						{title}
					</Typography>
				</Box>
				{headerExtra}
			</Box>
			<Box className="p-4">{children}</Box>
		</Paper>
	);
}

function display(s: Supplier, key: keyof Supplier): string {
	const v = s[key];
	if (v == null || v === '') return '—';
	return String(v);
}

export default function SupplierView() {
	const { supplierId } = useParams<{ supplierId: string }>();
	const { data: supplier, isLoading, isError } = useGetSupplierQuery(supplierId ?? '', {
		skip: !supplierId
	});

	if (isLoading) return <FuseLoading />;

	if (isError || !supplier) {
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
						Supplier could not be loaded
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mb-6">
						Check the link or return to the supplier list.
					</Typography>
					<Button
						variant="contained"
						color="secondary"
						component={Link}
						to="/setups/suppliers"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to suppliers
					</Button>
				</Paper>
			</Box>
		);
	}

	const name = supplier.name != null ? String(supplier.name).trim() : '';
	const title = name || '—';
	const notesList = Array.isArray(supplier.notes) ? supplier.notes : supplier.notes ? [supplier.notes] : [];

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
						<Box
							className="relative px-6 py-8 sm:px-8 sm:py-10"
							sx={{
								background: (theme) =>
									`linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`
							}}
						>
							<Stack
								direction={{ xs: 'column', sm: 'row' }}
								spacing={3}
								alignItems={{ xs: 'flex-start', sm: 'center' }}
								justifyContent="space-between"
							>
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
										{initialsFromSupplierName(name)}
									</Avatar>
									<Box>
										<Typography className="text-2xl sm:text-3xl font-extrabold tracking-tight" component="h1">
											{title}
										</Typography>
										<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
											Supplier profile
										</Typography>
									</Box>
								</Stack>

								<Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
									<Button
										variant="outlined"
										component={Link}
										to="/setups/suppliers"
										size="medium"
										sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
									>
										Suppliers
									</Button>
									<Button
										variant="contained"
										color="secondary"
										component={Link}
										to={`/setups/suppliers/${supplierId}/supplies`}
										size="medium"
										sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:truck</FuseSvgIcon>}
									>
										Recent supplies
									</Button>
									<Button
										variant="contained"
										color="primary"
										component={Link}
										to={`/setups/suppliers/${supplierId}`}
										size="medium"
										sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:pencil-square</FuseSvgIcon>}
									>
										Edit
									</Button>
								</Stack>
							</Stack>
						</Box>

						<Box className="px-4 py-6 sm:px-8 sm:pb-8 space-y-6">
							<SectionCard title="Supplier details" icon="heroicons-outline:building-storefront">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<ProfileField icon="heroicons-outline:tag" label="Name">
										<Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
											{title}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:user" label="Manager">
										<Typography variant="body1" fontWeight={600}>
											{display(supplier, 'manager')}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:phone" label="Phone">
										<Typography variant="body1" fontWeight={600}>
											{display(supplier, 'phone')}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:map-pin" label="Address">
										<Typography variant="body1" fontWeight={600} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
											{display(supplier, 'address')}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:user-circle" label="Linked user">
										<Typography variant="body1" fontWeight={600}>
											{display(supplier, 'user')}
										</Typography>
									</ProfileField>
									<ProfileField icon="heroicons-outline:calendar" label="Date added">
										<Typography variant="body1" fontWeight={600}>
											{formatDate(supplier.created_at)}
										</Typography>
									</ProfileField>
								</div>
							</SectionCard>

							{notesList.length > 0 && (
								<SectionCard title="Notes" icon="heroicons-outline:document-text">
									<Stack spacing={1.5}>
										{notesList.map((note: string, index: number) => (
											<Paper
												key={index}
												variant="outlined"
												sx={{
													p: 2,
													borderRadius: 2,
													borderColor: 'divider',
													bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.35 : 0.5)
												}}
											>
												<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
													{note}
												</Typography>
											</Paper>
										))}
									</Stack>
								</SectionCard>
							)}
						</Box>
					</Paper>
				</motion.div>
			</Box>
		</div>
	);
}
