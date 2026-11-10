'use client';

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import { appConfirm } from '@/utils/appConfirm';
import {
	UserSession,
	useGetMySessionsQuery,
	useRevokeMyOtherSessionsMutation,
	useRevokeMySessionMutation
} from '../ProfileApi';

function describeBrowser(ua?: string | null) {
	const s = String(ua || '');
	const browser = /Edg\//.test(s)
		? 'Edge'
		: /Chrome\//.test(s)
			? 'Chrome'
			: /Firefox\//.test(s)
				? 'Firefox'
				: /Safari\//.test(s)
					? 'Safari'
					: '';
	const os = /Windows/.test(s)
		? 'Windows'
		: /Mac OS X|Macintosh/.test(s)
			? 'Mac'
			: /Android/.test(s)
				? 'Android'
				: /iPhone|iPad/.test(s)
					? 'iOS'
					: /Linux/.test(s)
						? 'Linux'
						: '';
	return [browser, os].filter(Boolean).join(' on ') || 'Unknown device';
}

function sessionTitle(s: UserSession) {
	if (s.device_name) return s.device_name;
	if (s.platform === 'web' || !s.platform) return describeBrowser(s.user_agent);
	return `${s.platform} device`;
}

function lastActive(value: string) {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '';
	const mins = Math.round((Date.now() - d.getTime()) / 60000);
	if (mins < 10) return 'Active now';
	if (mins < 60) return `Active ${mins} min ago`;
	if (mins < 60 * 24) return `Active ${Math.round(mins / 60)} h ago`;
	return `Active ${d.toLocaleDateString()}`;
}

const errorMessage = (e: unknown, fallback: string) =>
	(e as { data?: { message?: string } })?.data?.message || fallback;

export default function SignedInDevicesPage() {
	const { data: sessions = [], isLoading } = useGetMySessionsQuery();
	const [revokeSession] = useRevokeMySessionMutation();
	const [revokeOthers, { isLoading: revokingOthers }] = useRevokeMyOtherSessionsMutation();
	const [busyId, setBusyId] = useState<string | null>(null);

	const others = sessions.filter((s) => !s.current);

	const onRevoke = async (s: UserSession) => {
		setBusyId(s.id);
		try {
			await revokeSession(s.id).unwrap();
			toast.success('Device signed out.');
		} catch (e) {
			toast.error(errorMessage(e, 'Could not sign out that device.'));
		} finally {
			setBusyId(null);
		}
	};

	const onRevokeOthers = async () => {
		const ok = await appConfirm({
			title: 'Sign out other devices?',
			message: 'Every other phone, tablet and browser signed in to your account will need to sign in again.',
			confirmLabel: 'Sign out',
			destructive: true
		});
		if (!ok) return;
		try {
			await revokeOthers().unwrap();
			toast.success('Other devices signed out.');
		} catch (e) {
			toast.error(errorMessage(e, 'Could not sign out other devices.'));
		}
	};

	return (
		<div className="w-full min-h-full flex flex-col px-4 py-6">
			<Box className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
				<Box className="flex items-center gap-3">
					<Box
						className="flex items-center justify-center rounded-xl shrink-0"
						sx={{ width: 56, height: 56, bgcolor: 'primary.main', color: 'primary.contrastText' }}
					>
						<FuseSvgIcon size={28}>heroicons-outline:device-phone-mobile</FuseSvgIcon>
					</Box>
					<div>
						<Typography
							variant="h4"
							fontWeight="bold"
						>
							Signed-in devices
						</Typography>
						<Typography
							variant="body2"
							color="text.secondary"
						>
							If you see a device you don&apos;t recognise, sign it out and change your password.
						</Typography>
					</div>
				</Box>
				<Button
					component={Link}
					to="/apps/profile"
					variant="outlined"
					size="small"
					startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
				>
					Back to profile
				</Button>
			</Box>
			<div className="w-full flex justify-center">
				<Paper className="max-w-2xl w-full rounded-xl shadow-sm">
					{isLoading ? (
						<Box className="flex justify-center p-8">
							<CircularProgress size={28} />
						</Box>
					) : sessions.length === 0 ? (
						<Typography
							color="text.secondary"
							className="p-6"
						>
							No devices recorded yet.
						</Typography>
					) : (
						sessions.map((s, i) => (
							<Box key={s.id}>
								{i > 0 ? <Divider /> : null}
								<Box className="flex items-center gap-4 px-5 py-4">
									<FuseSvgIcon
										size={26}
										color="action"
									>
										{s.platform === 'ios' || s.platform === 'android'
											? 'heroicons-outline:device-phone-mobile'
											: 'heroicons-outline:computer-desktop'}
									</FuseSvgIcon>
									<Box className="flex-1 min-w-0">
										<Box className="flex items-center gap-2">
											<Typography className="font-medium truncate">{sessionTitle(s)}</Typography>
											{s.current ? (
												<Chip
													size="small"
													color="success"
													label="This device"
												/>
											) : null}
										</Box>
										<Typography
											variant="caption"
											color="text.secondary"
										>
											{[
												lastActive(s.last_seen_at),
												s.app_version ? `v${s.app_version}` : '',
												s.platform === 'web' ? '' : s.ip || '',
												`Signed in ${new Date(s.created_at).toLocaleDateString()}`
											]
												.filter(Boolean)
												.join(' · ')}
										</Typography>
									</Box>
									{!s.current ? (
										<Button
											color="error"
											size="small"
											disabled={busyId != null}
											onClick={() => void onRevoke(s)}
										>
											{busyId === s.id ? <CircularProgress size={16} /> : 'Sign out'}
										</Button>
									) : null}
								</Box>
							</Box>
						))
					)}
					{others.length > 0 ? (
						<>
							<Divider />
							<Box className="flex justify-end p-4">
								<Button
									variant="outlined"
									color="error"
									disabled={revokingOthers}
									onClick={() => void onRevokeOthers()}
								>
									Sign out all other devices
								</Button>
							</Box>
						</>
					) : null}
				</Paper>
			</div>
		</div>
	);
}
