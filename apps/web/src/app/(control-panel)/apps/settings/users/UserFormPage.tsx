'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { useGetWarehousesQuery } from 'src/app/(control-panel)/setups/warehouses/WarehouseApi';
import {
	useGetRolesQuery,
	useGetUserQuery,
	useCreateUserMutation,
	useUpdateUserMutation,
	type SystemUserUpdate
} from './UsersApi';
import toast from 'react-hot-toast';
import Alert from '@mui/material/Alert';
import useUser from '@auth/useUser';

type UserFormPageProps = {
	isNew?: boolean;
};

/** RTK Query `unwrap()` errors often expose API body on `data`. */
function isDuplicatePhoneConstraintError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const rec = err as Record<string, unknown>;
	const parts: string[] = [];
	const data = rec.data;
	if (typeof data === 'string') {
		parts.push(data);
	} else if (data && typeof data === 'object') {
		const d = data as Record<string, unknown>;
		if (typeof d.error === 'string') parts.push(d.error);
		if (typeof d.message === 'string') parts.push(d.message);
	}
	if (typeof rec.error === 'string') parts.push(rec.error);
	if (typeof rec.message === 'string') parts.push(rec.message);
	const haystack = parts.join(' ').toLowerCase();
	return (
		haystack.includes('users_phone_key') ||
		(haystack.includes('duplicate') && haystack.includes('phone') && haystack.includes('unique'))
	);
}

type EditFormBaseline = {
	first_name: string;
	last_name: string;
	phone: string;
	is_active: boolean;
	warehouse_id: string | null;
	role_id: string | null;
};

function normId(v: string | null | undefined): string | null {
	if (v == null || v === '') return null;
	return String(v);
}

function initialsFromName(first?: string, last?: string): string {
	const a = (first || '').trim().charAt(0);
	const b = (last || '').trim().charAt(0);
	const s = `${a}${b}`.toUpperCase();
	return s || '?';
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
			<Box className="p-4 flex flex-col gap-3">{children}</Box>
		</Paper>
	);
}

function apiErrorMessage(err: unknown): string | null {
	if (!err || typeof err !== 'object') return null;
	const rec = err as Record<string, unknown>;
	const data = rec.data;
	if (data && typeof data === 'object') {
		const m = (data as Record<string, unknown>).message;
		if (typeof m === 'string' && m.trim()) return m.trim();
	}
	return null;
}

export default function UserFormPage({ isNew }: UserFormPageProps) {
	const router = useRouter();
	const params = useParams();
	const userId = params.userId as string | undefined;
	const { data: authUser } = useUser();
	const planUsage = authUser?.company?.plan_usage ?? authUser?.company?.subscription?.limits;
	const atUserPlanCap = Boolean(
		isNew && planUsage && planUsage.userCount >= planUsage.maxUsers
	);

	const { data: user, isLoading: userLoading } = useGetUserQuery(userId ?? '', { skip: !userId || isNew });
	const [createUser, { isLoading: creating }] = useCreateUserMutation();
	const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
	const { data: warehouses } = useGetWarehousesQuery(null, { skip: false });
	const { data: rolesFromServer = [] } = useGetRolesQuery();

	const roleOptions =
		rolesFromServer.length > 0
			? rolesFromServer
					.map((r) => {
						const name = String((r as any)?.name ?? '').trim();
						if (!name) return null;
						const normalized = name.toLowerCase();
						// const value = normalized.includes('admin') ? 1 : 2;
						const value = r.id;
						return { value, label: name };
					})
					.filter(Boolean) as { value: string; label: string }[]
			: [];

	const [form, setForm] = useState({
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		// user_type: 2,
		is_active: true,
		warehouse_id: '' as string | null,
		role_id: '' as string | null
	});

	const editBaselineRef = useRef<EditFormBaseline | null>(null);

	useEffect(() => {
		if (user) {
			setForm((prev) => ({
				...prev,
				first_name: user.first_name ?? '',
				last_name: user.last_name ?? '',
				email: user.email ?? '',
				phone: user.phone ?? '',
				// user_type: user.user_type ?? 2,
				is_active: user.is_active !== false,
				warehouse_id: user.warehouse_id ?? null,
				role_id: user.roles?.[0]?.id ?? null
			}));
		}
	}, [user]);

	useEffect(() => {
		if (isNew || !user) {
			editBaselineRef.current = null;
			return;
		}
		editBaselineRef.current = {
			first_name: (user.first_name ?? '').trim(),
			last_name: (user.last_name ?? '').trim(),
			phone: (user.phone ?? '').trim(),
			is_active: user.is_active !== false,
			warehouse_id: normId(user.warehouse_id),
			role_id: normId(user.roles?.[0]?.id)
		};
	}, [user, isNew]);

	const handleChange =
		(field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			const t = e.target;
			const value = t instanceof HTMLInputElement && t.type === 'checkbox' ? t.checked : t.value;
			setForm((prev) => ({ ...prev, [field]: value }));
		};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const { first_name, last_name, email, phone, is_active, warehouse_id, role_id } = form; //user_type
		if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
			toast.error('First name, last name and email are required');
			return;
		}
		try {
			if (isNew) {
				await createUser({
					first_name: first_name.trim(),
					last_name: last_name.trim(),
					email: email.trim(),
					phone: phone?.trim() || undefined,
					// user_type: Number(user_type),
					warehouse_id: warehouse_id || undefined,
					role_id: role_id || null
				}).unwrap();
				toast.success('User created');
			} else if (userId) {
				const baseline = editBaselineRef.current;
				const wCur = normId(warehouse_id);
				const rCur = normId(role_id);
				const phoneCur = (phone ?? '').trim();

				let data: SystemUserUpdate;
				if (baseline) {
					data = {id: userId};
					if (first_name.trim() !== baseline.first_name) data.first_name = first_name.trim();
					if (last_name.trim() !== baseline.last_name) data.last_name = last_name.trim();
					if (phoneCur !== baseline.phone) data.phone = phoneCur || null;
					if (is_active !== baseline.is_active) data.is_active = is_active;
					if (wCur !== baseline.warehouse_id) data.warehouse_id = wCur;
					if (rCur !== baseline.role_id) data.role_id = rCur;
				} else {
					data = {
						id: userId,
						first_name: first_name.trim(),
						last_name: last_name.trim(),
						phone: phoneCur || null,
						is_active,
						warehouse_id: wCur,
						role_id: rCur
					};
				}

				if (Object.keys(data).length === 0) {
					toast('No changes to save.');
					return;
				}

				await updateUser({
					id: userId,
					data
				}).unwrap();
				toast.success('User updated');
			}
			router.push('/users/staff');
		} catch (err: unknown) {
			if (isDuplicatePhoneConstraintError(err)) {
				toast.error('This phone number is already in use.');
				return;
			}
			toast.error(
				apiErrorMessage(err) ||
					(isNew ? 'Failed to create user' : 'Failed to update user')
			);
		}
	};

	if (!isNew && userId && userLoading) {
		return <FuseLoading />;
	}

	const fullNamePreview =
		`${form.first_name || ''} ${form.last_name || ''}`.trim() || (isNew ? 'New user' : 'Edit user');

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
					className="max-w-3xl mx-auto"
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
							className="px-6 py-8 sm:px-8 sm:py-9"
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
											width: 64,
											height: 64,
											fontSize: '1.35rem',
											fontWeight: 800,
											bgcolor: 'primary.main',
											color: 'primary.contrastText',
											boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`
										}}
									>
										{initialsFromName(form.first_name, form.last_name)}
									</Avatar>
									<Box>
										<Typography className="text-2xl sm:text-3xl font-extrabold tracking-tight" component="h1">
											{isNew ? 'Add user' : 'Edit user'}
										</Typography>
										<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
											{fullNamePreview}
											{!isNew && userId ? ' · Update account details' : ' · Create a staff account'}
										</Typography>
									</Box>
								</Stack>

								<Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
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
									{!isNew && userId && (
										<Button
											variant="contained"
											color="secondary"
											component={Link}
											to={`/users/staff/${userId}/view`}
											size="medium"
											sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
											startIcon={<FuseSvgIcon size={18}>heroicons-outline:eye</FuseSvgIcon>}
										>
											View profile
										</Button>
									)}
								</Stack>
							</Stack>
						</Box>

						<form onSubmit={handleSubmit}>
							<Box className="px-4 py-6 sm:px-8 sm:pb-8 space-y-5">
								{atUserPlanCap && planUsage ? (
									<Alert severity="warning">
										You have reached your plan limit of {planUsage.maxUsers} users. Remove a user or
										upgrade your subscription to add another account.
									</Alert>
								) : null}
								<SectionCard title="Identity" icon="heroicons-outline:user">
									<Box className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<TextField
											label="First name"
											value={form.first_name}
											onChange={handleChange('first_name')}
											required
											fullWidth
											sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">
														<FuseSvgIcon size={20} color="action">
															heroicons-outline:user
														</FuseSvgIcon>
													</InputAdornment>
												)
											}}
										/>
										<TextField
											label="Last name"
											value={form.last_name}
											onChange={handleChange('last_name')}
											required
											fullWidth
											sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">
														<FuseSvgIcon size={20} color="action">
															heroicons-outline:user
														</FuseSvgIcon>
													</InputAdornment>
												)
											}}
										/>
									</Box>
								</SectionCard>

								<SectionCard title="Contact" icon="heroicons-outline:envelope">
									<TextField
										label="Email"
										type="email"
										value={form.email}
										onChange={handleChange('email')}
										required
										fullWidth
										disabled={!isNew}
										helperText={!isNew ? 'Email cannot be changed after creation' : undefined}
										sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
										label="Phone"
										value={form.phone}
										onChange={handleChange('phone')}
										fullWidth
										sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
								</SectionCard>

								<SectionCard title="Access" icon="heroicons-outline:shield-check">
									<FormControl fullWidth>
										<InputLabel id="user-form-role-label">Role</InputLabel>
										<Select
											labelId="user-form-role-label"
											label="Role"
											value={form.role_id}
											onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}
											sx={{ borderRadius: 2 }}
										>
											{roleOptions.map((r) => (
												<MenuItem key={`${r.value}-${r.label}`} value={r.value}>
													{r.label}
												</MenuItem>
											))}
										</Select>
									</FormControl>
									<FormControl fullWidth>
										<InputLabel id="user-form-warehouse-label">Warehouse</InputLabel>
										<Select
											labelId="user-form-warehouse-label"
											label="Warehouse"
											value={form.warehouse_id ?? ''}
											onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value || null }))}
											sx={{ borderRadius: 2 }}
										>
											<MenuItem value="">None</MenuItem>
											{warehouses?.map((w) => (
												<MenuItem key={w.id} value={w.id}>
													{w.name}
												</MenuItem>
											))}
										</Select>
									</FormControl>
									{!isNew && (
										<Paper
											variant="outlined"
											className="p-3 rounded-xl"
											sx={{
												borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
												bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04)
											}}
										>
											<FormControlLabel
												control={
													<Switch
														checked={form.is_active}
														onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
														color="primary"
													/>
												}
												label={
													<Box>
														<Typography variant="body2" fontWeight={600}>
															Account active
														</Typography>
														<Typography variant="caption" color="text.secondary">
															User can sign in when enabled
														</Typography>
													</Box>
												}
												sx={{ alignItems: 'center', m: 0 }}
											/>
										</Paper>
									)}
								</SectionCard>
							</Box>

							<Box
								className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 px-4 py-4 sm:px-8 sm:py-5"
								sx={{
									borderTop: '1px solid',
									borderColor: 'divider',
									bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.4 : 0.65)
								}}
							>
								<Button
									variant="outlined"
									component={Link}
									to="/users/staff"
									sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="contained"
									color="primary"
									disabled={creating || updating || atUserPlanCap}
									sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, minWidth: 160 }}
									startIcon={<FuseSvgIcon size={18}>heroicons-outline:check</FuseSvgIcon>}
								>
									{creating || updating ? 'Saving…' : isNew ? 'Create user' : 'Save changes'}
								</Button>
							</Box>
						</form>
					</Paper>
				</motion.div>
			</Box>
		</div>
	);
}
