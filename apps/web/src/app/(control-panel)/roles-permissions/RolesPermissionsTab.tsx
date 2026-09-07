'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useUser from '@auth/useUser';
import { hasPermissionCodes } from '@auth/permissions';
import { useSnackbar } from 'notistack';
import { useGetRolesQuery } from '../apps/settings/users/UsersApi';
import type { Role } from '../apps/settings/users/UsersApi';
import {
	useGetPermissionsQuery,
	useGetRolePermissionsQuery,
	useCreateRoleMutation,
	useUpdateRoleMutation,
	useDeleteRoleMutation
} from './RolesPermissionsApi';

/** Parity with `cheqstock/src/containers/settings/roles.js` — `/api/roles`, `/api/permissions`. */
export default function RolesPermissionsTab() {
	const theme = useTheme();
	const { data: user } = useUser();
	const { enqueueSnackbar } = useSnackbar();
	const { data: roles = [], isLoading: rolesLoading, refetch: refetchRoles } = useGetRolesQuery();
	const { data: allPermissions = [], isLoading: permsLoading } = useGetPermissionsQuery();

	const [search, setSearch] = useState('');
	const [editorOpen, setEditorOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<Role | null>(null);
	const [roleName, setRoleName] = useState('');
	const [roleDescription, setRoleDescription] = useState('');
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [permSearch, setPermSearch] = useState('');

	const editingId = editingRole?.id ?? '';
	const { data: loadedRolePerms = [], isFetching: loadingRolePerms } = useGetRolePermissionsQuery(editingId, {
		skip: !editorOpen || !editingId
	});

	const [createRole, { isLoading: creating }] = useCreateRoleMutation();
	const [updateRole, { isLoading: updating }] = useUpdateRoleMutation();
	const [deleteRole, { isLoading: deleting }] = useDeleteRoleMutation();

	const canCreate = hasPermissionCodes(user, ['roles.create', 'users.roles.create']);
	const canUpdate = hasPermissionCodes(user, ['roles.update', 'users.roles.update']);
	const canDelete = hasPermissionCodes(user, ['roles.delete', 'users.roles.delete']);

	const filteredRoles = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return roles;
		return roles.filter((r) => {
			const label = String(r?.name ?? '').toLowerCase();
			const id = String(r?.id ?? '').toLowerCase();
			const desc = String(r?.description ?? '').toLowerCase();
			return label.includes(q) || id.includes(q) || desc.includes(q);
		});
	}, [roles, search]);

	const filteredPermissions = useMemo(() => {
		const q = permSearch.trim().toLowerCase();
		if (!q) return allPermissions;
		return allPermissions.filter((p) => {
			const label = String(p?.name ?? p?.code ?? p?.id ?? '').toLowerCase();
			const desc = String(p?.description ?? '').toLowerCase();
			return label.includes(q) || desc.includes(q);
		});
	}, [allPermissions, permSearch]);

	const openCreate = useCallback(() => {
		setEditingRole(null);
		setRoleName('');
		setRoleDescription('');
		setSelectedIds([]);
		setPermSearch('');
		setEditorOpen(true);
	}, []);

	const openEdit = useCallback((role: Role) => {
		setEditingRole(role);
		setRoleName(String(role?.name ?? '').trim());
		setRoleDescription(String(role?.description ?? '').trim());
		setSelectedIds([]);
		setPermSearch('');
		setEditorOpen(true);
	}, []);

	useEffect(() => {
		if (!editorOpen) return;
		if (!editingRole?.id) {
			setSelectedIds([]);
		}
	}, [editorOpen, editingRole?.id]);

	useEffect(() => {
		if (!editorOpen || !editingRole?.id) return;
		if (loadingRolePerms) return;
		setSelectedIds(loadedRolePerms.map((p) => p.id).filter(Boolean));
	}, [editorOpen, editingRole?.id, loadingRolePerms, loadedRolePerms]);

	const togglePerm = useCallback((id: string) => {
		setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
	}, []);

	const toggleAll = useCallback(() => {
		const allIds = filteredPermissions.map((p) => p.id).filter(Boolean);
		const allOn = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
		setSelectedIds(allOn ? [] : allIds);
	}, [filteredPermissions, selectedIds]);

	const save = useCallback(async () => {
		const name = roleName.trim();
		if (!name) {
			enqueueSnackbar('Enter a role name.', { variant: 'warning' });
			return;
		}
		if (selectedIds.length === 0) {
			enqueueSnackbar('Select at least one permission.', { variant: 'warning' });
			return;
		}
		const description = roleDescription.trim() || null;
		try {
			if (editingRole?.id) {
				if (!canUpdate) {
					enqueueSnackbar('You cannot update roles.', { variant: 'warning' });
					return;
				}
				await updateRole({ id: editingRole.id, name, description, permission_ids: selectedIds }).unwrap();
			} else {
				if (!canCreate) {
					enqueueSnackbar('You cannot create roles.', { variant: 'warning' });
					return;
				}
				await createRole({ name, description, permission_ids: selectedIds }).unwrap();
			}
			setEditorOpen(false);
			refetchRoles();
			enqueueSnackbar('Role saved.', { variant: 'success' });
		} catch (e: any) {
			const msg = e?.data?.message || e?.message || 'Failed to save role.';
			enqueueSnackbar(String(msg), { variant: 'error' });
		}
	}, [
		roleName,
		roleDescription,
		selectedIds,
		editingRole,
		canCreate,
		canUpdate,
		createRole,
		updateRole,
		refetchRoles,
		enqueueSnackbar
	]);

	const remove = useCallback(
		async (role: Role) => {
			if (!canDelete) {
				enqueueSnackbar('You cannot delete roles.', { variant: 'warning' });
				return;
			}
			const id = role?.id;
			if (!id) return;
			const ok = window.confirm(`Delete role "${role?.name ?? id}"?`);
			if (!ok) return;
			try {
				await deleteRole(id).unwrap();
				refetchRoles();
				enqueueSnackbar('Role deleted.', { variant: 'success' });
			} catch (e: any) {
				const msg = e?.data?.message || e?.message || 'Failed to delete role.';
				enqueueSnackbar(String(msg), { variant: 'error' });
			}
		},
		[canDelete, deleteRole, refetchRoles, enqueueSnackbar]
	);

	const loading = rolesLoading || permsLoading;
	const saving = creating || updating;

	if (loading) {
		return (
			<Box className="mx-auto flex min-h-[320px] w-full max-w-6xl items-center justify-center px-4 pb-12 sm:px-6">
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box className="mx-auto w-full max-w-6xl flex-auto flex-col px-4 pb-12 sm:px-6">
			{/* Hero — aligned with `reports/ReportsListPage.tsx` */}
			<Paper
				elevation={0}
				className="mb-8 overflow-hidden rounded-2xl sm:mb-10"
				sx={{
					background:
						theme.palette.mode === 'dark'
							? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.12)} 100%)`
							: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
					border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
				}}
			>
				<Box className="px-4 py-8 sm:px-10 sm:py-10">
					<Box className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
						<Box className="max-w-2xl">
							<Typography
								variant="overline"
								className="mb-2 block font-semibold tracking-widest"
								sx={{ color: theme.palette.primary.main }}
							>
								Administration
							</Typography>
							<Typography variant="h4" className="font-bold tracking-tight">
								Roles & permissions
							</Typography>
							<Typography className="text-secondary mt-3 text-base leading-relaxed">
								Create role definitions and map permissions—aligned with the mobile Admin → Roles & Permissions
								screen.
							</Typography>
						</Box>
						<Box className="flex flex-wrap items-center gap-2 self-start sm:justify-end">
							<Chip
								size="medium"
								label={`${roles.length} role${roles.length === 1 ? '' : 's'}`}
								sx={{
									fontWeight: 600,
									bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.15 : 0.85),
									border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
								}}
							/>
							<Chip
								size="medium"
								label={`${allPermissions.length} permission${allPermissions.length === 1 ? '' : 's'}`}
								sx={{
									fontWeight: 600,
									bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.15 : 0.85),
									border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
								}}
							/>
							<Button
								variant="contained"
								color="secondary"
								startIcon={<FuseSvgIcon>heroicons-outline:plus</FuseSvgIcon>}
								onClick={
									canCreate ? openCreate : () => enqueueSnackbar('You cannot create roles.', { variant: 'warning' })
								}
								disabled={!canCreate}
							>
								New role
							</Button>
						</Box>
					</Box>

					<TextField
						className="mt-8 w-full max-w-xl"
						size="medium"
						placeholder="Search roles by name or id…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						autoComplete="off"
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<FuseSvgIcon size={22} color="action">
										heroicons-outline:magnifying-glass
									</FuseSvgIcon>
								</InputAdornment>
							),
							endAdornment: search ? (
								<InputAdornment position="end">
									<IconButton
										size="small"
										aria-label="Clear search"
										onClick={() => setSearch('')}
										edge="end"
									>
										<FuseSvgIcon size={18}>heroicons-outline:x-mark</FuseSvgIcon>
									</IconButton>
								</InputAdornment>
							) : null,
							sx: {
								borderRadius: 3,
								bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.4 : 0.95)
							}
						}}
					/>
				</Box>
			</Paper>

			<Paper className="overflow-hidden rounded-lg">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Role</TableCell>
							<TableCell align="right">Users</TableCell>
							<TableCell align="right" className="w-120">
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{filteredRoles.length === 0 && (
							<TableRow>
								<TableCell colSpan={3}>
									<Typography color="text.secondary">No roles match your search.</Typography>
								</TableCell>
							</TableRow>
						)}
						{filteredRoles.map((row) => (
							<TableRow key={row.id} hover>
								<TableCell>
									<Typography className="font-medium">{row.name || row.id}</Typography>
									{row.description ? (
										<Typography variant="caption" color="text.secondary" display="block">
											{row.description}
										</Typography>
									) : null}
								</TableCell>
								<TableCell align="right">{row.user_count ?? '—'}</TableCell>
								<TableCell align="right">
									<IconButton
										size="small"
										onClick={canUpdate ? () => openEdit(row) : () => enqueueSnackbar('You cannot update roles.', { variant: 'warning' })}
										disabled={!canUpdate}
										aria-label="Edit role"
									>
										<FuseSvgIcon size={20}>heroicons-outline:pencil</FuseSvgIcon>
									</IconButton>
									<IconButton
										size="small"
										color="error"
										onClick={() => remove(row)}
										disabled={!canDelete || deleting}
										aria-label="Delete role"
									>
										<FuseSvgIcon size={20}>heroicons-outline:trash</FuseSvgIcon>
									</IconButton>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Paper>

			<Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="sm" fullWidth scroll="paper">
				<DialogTitle>{editingRole ? 'Edit role' : 'New role'}</DialogTitle>
				<DialogContent className="flex flex-col gap-3 pt-2">
					<Box className="flex flex-col gap-1">
						<TextField
							autoFocus
							label="Role name"
							value={roleName}
							onChange={(e) => setRoleName(e.target.value)}
							fullWidth
							margin="none"
							size="small"
						/>
						<TextField
							className="mt-3"
							label="Description"
							value={roleDescription}
							onChange={(e) => setRoleDescription(e.target.value)}
							fullWidth
							margin="none"
							size="small"
							// multiline
							minRows={2}
							placeholder="Optional — what this role is for"
							inputProps={{ maxLength: 255 }}
							helperText={`${roleDescription.length}/255`}
						/>
					</Box>
					<Box className="flex flex-col gap-1">
						<Box className="flex items-center justify-between gap-8">
							<Typography variant="subtitle2">Permissions ({selectedIds.length} selected)</Typography>
							<Button size="small" onClick={toggleAll}>
								{filteredPermissions.length > 0 && filteredPermissions.every((p) => selectedIds.includes(p.id))
									? 'Clear all'
									: 'Select all'}
							</Button>
						</Box>
						<TextField
							size="small"
							label="Filter permissions"
							value={permSearch}
							onChange={(e) => setPermSearch(e.target.value)}
							fullWidth
							margin="none"
						/>
					</Box>
					{editingId && loadingRolePerms ? (
						<Box className="flex justify-center py-24">
							<CircularProgress size={28} />
						</Box>
					) : (
						<Box className="max-h-[360px] overflow-y-auto pr-8">
							{filteredPermissions.map((p) => (
								<FormControlLabel
									key={p.id}
									className="mr-0 -ml-2 block py-0"
									sx={{ my: 0, minHeight: 36, alignItems: 'center' }}
									control={
										<Checkbox
											size="small"
											checked={selectedIds.includes(p.id)}
											onChange={() => togglePerm(p.id)}
											disabled={editingRole ? !canUpdate : !canCreate}
										/>
									}
									label={
										<Typography variant="body2" component="span" className="font-medium">
											{p.name?.trim() ? p.name : '—'}
										</Typography>
									}
								/>
							))}
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setEditorOpen(false)}>Cancel</Button>
					<Button
						variant="contained"
						onClick={save}
						disabled={saving || Boolean(editingId && loadingRolePerms)}
					>
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
