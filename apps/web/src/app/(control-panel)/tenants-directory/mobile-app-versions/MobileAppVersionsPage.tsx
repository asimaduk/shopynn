'use client';

import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Divider from '@mui/material/Divider';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import {
	useCreateAppVersionMutation,
	useGetAppVersionsQuery,
	useUpdateAppVersionMutation
} from '../../billing/SubscriptionApi';
import toast from 'react-hot-toast';

type PlatformKey = 'android' | 'ios';

type FormState = {
	latest_version: string;
	min_supported_version: string;
	force_update: boolean;
	release_notes: string;
	store_url: string;
};

const EMPTY_FORM: FormState = {
	latest_version: '',
	min_supported_version: '',
	force_update: false,
	release_notes: '',
	store_url: ''
};

function formatWhen(iso?: string) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export default function MobileAppVersionsPage() {
	const [platform, setPlatform] = useState<PlatformKey>('android');
	const { data, isLoading, refetch } = useGetAppVersionsQuery({ platform });
	const [createVersion, { isLoading: creating }] = useCreateAppVersionMutation();
	const [updateVersion, { isLoading: updating }] = useUpdateAppVersionMutation();
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [editingId, setEditingId] = useState<string | null>(null);

	const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
	const active = useMemo(() => rows.find((r) => String(r.status).toLowerCase() === 'active') || null, [rows]);
	const history = useMemo(
		() => rows.filter((r) => String(r.status).toLowerCase() !== 'active'),
		[rows]
	);

	useEffect(() => {
		setEditingId(null);
		if (active) {
			setForm({
				latest_version: active.latest_version || '',
				min_supported_version: active.min_supported_version || '',
				force_update: Boolean(active.force_update),
				release_notes: active.release_notes || '',
				store_url: active.store_url || ''
			});
		} else {
			setForm(EMPTY_FORM);
		}
	}, [platform, active?.id]);

	const saving = creating || updating;

	const handlePublish = async () => {
		if (!form.latest_version.trim() || !form.min_supported_version.trim()) {
			toast.error('Latest and minimum supported versions are required');
			return;
		}
		const body = {
			platform,
			latest_version: form.latest_version.trim(),
			min_supported_version: form.min_supported_version.trim(),
			force_update: form.force_update,
			release_notes: form.release_notes.trim() || null,
			store_url: form.store_url.trim() || null,
			status: 'active'
		};
		try {
			if (editingId) {
				await updateVersion({ id: editingId, body }).unwrap();
				toast.success('Version config updated');
			} else {
				await createVersion(body).unwrap();
				toast.success('Version config published');
			}
			setEditingId(null);
			refetch();
		} catch (err: any) {
			toast.error(err?.data?.message || err?.data?.error || 'Could not save');
		}
	};

	const handleDeactivate = async (id: string) => {
		try {
			await updateVersion({ id, body: { status: 'inactive' } }).unwrap();
			toast.success('Deactivated');
			refetch();
		} catch (err: any) {
			toast.error(err?.data?.message || 'Could not deactivate');
		}
	};

	const handleEdit = (row: (typeof rows)[0]) => {
		setEditingId(row.id);
		setForm({
			latest_version: row.latest_version || '',
			min_supported_version: row.min_supported_version || '',
			force_update: Boolean(row.force_update),
			release_notes: row.release_notes || '',
			store_url: row.store_url || ''
		});
	};

	const handleNewPublish = () => {
		setEditingId(null);
		setForm({
			latest_version: active?.latest_version || '',
			min_supported_version: active?.min_supported_version || '',
			force_update: Boolean(active?.force_update),
			release_notes: active?.release_notes || '',
			store_url: active?.store_url || ''
		});
	};

	return (
		<PlanFeatureGate requiredFeatures={['tenants.directory.view']} requiredPermissions={['tenants.directory.view']}>
			<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
				<PageBreadcrumb className="mb-4" />
				<Typography component="h1" className="text-3xl font-extrabold tracking-tight">
					Mobile app versions
				</Typography>
				<Typography variant="body2" color="text.secondary" className="mb-4 mt-1 max-w-3xl">
					Publish latest and minimum supported versions for iOS and Android. Soft updates prompt on launch;
					force update (or versions below minimum) blocks the app until upgraded. Platform admin only.
				</Typography>

				<Paper variant="outlined" className="mb-4 overflow-hidden" sx={{ borderRadius: 2 }}>
					<Tabs
						value={platform}
						onChange={(_e, v) => setPlatform(v)}
						sx={{ minHeight: 44, px: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
					>
						<Tab value="android" label="Android" />
						<Tab value="ios" label="iOS" />
					</Tabs>
				</Paper>

				{isLoading ? (
					<FuseLoading />
				) : (
					<Box className="flex flex-col gap-4 lg:flex-row lg:items-start">
						<Paper variant="outlined" className="flex-1 p-4" sx={{ borderRadius: 2 }}>
							<Box className="mb-3 flex items-center justify-between gap-2">
								<Typography variant="subtitle1" fontWeight={700}>
									{editingId ? 'Edit config' : 'Publish active config'}
								</Typography>
								{editingId ? (
									<Button size="small" onClick={handleNewPublish}>
										New publish instead
									</Button>
								) : null}
							</Box>

							{active && !editingId ? (
								<Alert severity="info" className="mb-3">
									Active: <strong>{active.latest_version}</strong> (min {active.min_supported_version})
									{active.force_update ? ' · force update on' : ' · soft update'}
								</Alert>
							) : null}

							<TextField
								fullWidth
								className="mb-3"
								label="Latest version"
								placeholder="1.2.0"
								value={form.latest_version}
								onChange={(e) => setForm((f) => ({ ...f, latest_version: e.target.value }))}
								helperText="Store / build version merchants should upgrade to"
							/>
							<TextField
								fullWidth
								className="mb-3"
								label="Minimum supported version"
								placeholder="1.1.0"
								value={form.min_supported_version}
								onChange={(e) => setForm((f) => ({ ...f, min_supported_version: e.target.value }))}
								helperText="Anything older is always forced to update"
							/>
							<FormControlLabel
								className="mb-2"
								control={
									<Switch
										checked={form.force_update}
										onChange={(e) => setForm((f) => ({ ...f, force_update: e.target.checked }))}
									/>
								}
								label="Force update when behind latest"
							/>
							<Typography variant="caption" color="text.secondary" display="block" className="mb-3">
								Off = soft prompt (Skip allowed) for versions between min and latest. On = blocking
								update for anyone below latest.
							</Typography>
							<TextField
								fullWidth
								className="mb-3"
								label="Release notes"
								multiline
								minRows={3}
								value={form.release_notes}
								onChange={(e) => setForm((f) => ({ ...f, release_notes: e.target.value }))}
								helperText="Shown on soft alert and force-update screen"
							/>
							<TextField
								fullWidth
								className="mb-3"
								label="Store URL (optional)"
								placeholder={
									platform === 'android'
										? 'https://play.google.com/store/apps/details?id=com.shopynn'
										: 'https://apps.apple.com/...'
								}
								value={form.store_url}
								onChange={(e) => setForm((f) => ({ ...f, store_url: e.target.value }))}
							/>
							<Button variant="contained" disabled={saving} onClick={handlePublish}>
								{saving ? 'Saving…' : editingId ? 'Save changes' : 'Publish active'}
							</Button>
						</Paper>

						<Paper variant="outlined" className="flex-1 overflow-hidden" sx={{ borderRadius: 2 }}>
							<Box className="px-4 py-3">
								<Typography variant="subtitle1" fontWeight={700}>
									History ({platform})
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Only one active config per platform. Publishing deactivates the previous active
									row.
								</Typography>
							</Box>
							<Divider />
							{rows.length === 0 ? (
								<Box className="p-6">
									<Typography color="text.secondary">No version configs yet.</Typography>
								</Box>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>Versions</TableCell>
											<TableCell>Mode</TableCell>
											<TableCell>Status</TableCell>
											<TableCell>When</TableCell>
											<TableCell align="right">Actions</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{rows.map((row) => {
											const isActive = String(row.status).toLowerCase() === 'active';
											return (
												<TableRow key={row.id} hover>
													<TableCell>
														<div className="font-semibold">{row.latest_version}</div>
														<div className="text-xs text-gray-500">min {row.min_supported_version}</div>
													</TableCell>
													<TableCell>
														{row.force_update ? 'Force' : 'Soft'}
													</TableCell>
													<TableCell>
														<Chip
															size="small"
															label={isActive ? 'Active' : 'Inactive'}
															color={isActive ? 'success' : 'default'}
															variant={isActive ? 'filled' : 'outlined'}
														/>
													</TableCell>
													<TableCell>{formatWhen(row.updated_at || row.created_at)}</TableCell>
													<TableCell align="right">
														<Button size="small" onClick={() => handleEdit(row)}>
															Edit
														</Button>
														{isActive ? (
															<Button size="small" color="warning" onClick={() => handleDeactivate(row.id)}>
																Deactivate
															</Button>
														) : null}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							)}
							{history.length === 0 && active ? (
								<Box className="px-4 pb-3">
									<Typography variant="caption" color="text.secondary">
										No inactive history yet.
									</Typography>
								</Box>
							) : null}
						</Paper>
					</Box>
				)}
			</Box>
		</PlanFeatureGate>
	);
}
