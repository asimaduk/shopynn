'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { signInCallbackUrl } from '@/@auth/signOutUrl';

/** Total idle time before forced sign-out (includes warning window). */
const IDLE_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS) || 15 * 60 * 1000;
/** How long the warning modal stays open before auto logout. */
const WARN_BEFORE_MS = Number(process.env.NEXT_PUBLIC_IDLE_WARN_MS) || 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
	'mousedown',
	'mousemove',
	'keydown',
	'scroll',
	'touchstart',
	'click',
	'wheel'
];

function formatCountdown(totalSeconds: number): string {
	const s = Math.max(0, totalSeconds);
	const m = Math.floor(s / 60);
	const r = s % 60;
	return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

/**
 * Signs authenticated users out after inactivity, with a branded countdown modal.
 */
export default function InactivityLogout() {
	const { status } = useSession();
	const theme = useTheme();
	const [warningOpen, setWarningOpen] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARN_BEFORE_MS / 1000));
	const [signingOut, setSigningOut] = useState(false);

	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastActivityRef = useRef(0);
	const warningOpenRef = useRef(false);

	const clearTimers = useCallback(() => {
		if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
		if (countdownRef.current) clearInterval(countdownRef.current);
		idleTimerRef.current = null;
		warnTimerRef.current = null;
		countdownRef.current = null;
	}, []);

	const doSignOut = useCallback(async () => {
		if (signingOut) return;
		setSigningOut(true);
		clearTimers();
		try {
			await signOut({ callbackUrl: signInCallbackUrl('reason=idle') });
		} catch {
			window.location.href = signInCallbackUrl('reason=idle');
		}
	}, [clearTimers, signingOut]);

	const openWarning = useCallback(() => {
		warningOpenRef.current = true;
		setWarningOpen(true);
		setSecondsLeft(Math.ceil(WARN_BEFORE_MS / 1000));

		if (countdownRef.current) clearInterval(countdownRef.current);
		const started = Date.now();
		countdownRef.current = setInterval(() => {
			const remaining = Math.ceil((WARN_BEFORE_MS - (Date.now() - started)) / 1000);
			setSecondsLeft(remaining);
			if (remaining <= 0 && countdownRef.current) {
				clearInterval(countdownRef.current);
				countdownRef.current = null;
			}
		}, 250);

		if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
		warnTimerRef.current = setTimeout(() => {
			void doSignOut();
		}, WARN_BEFORE_MS);
	}, [doSignOut]);

	const scheduleIdle = useCallback(() => {
		if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		const warnAt = Math.max(0, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
		idleTimerRef.current = setTimeout(() => {
			openWarning();
		}, warnAt);
	}, [openWarning]);

	const staySignedIn = useCallback(() => {
		warningOpenRef.current = false;
		setWarningOpen(false);
		setSigningOut(false);
		if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
		if (countdownRef.current) clearInterval(countdownRef.current);
		warnTimerRef.current = null;
		countdownRef.current = null;
		scheduleIdle();
	}, [scheduleIdle]);

	const onActivity = useCallback(() => {
		if (warningOpenRef.current) return;
		const now = Date.now();
		if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
		lastActivityRef.current = now;
		scheduleIdle();
	}, [scheduleIdle]);

	useEffect(() => {
		if (status !== 'authenticated') {
			clearTimers();
			warningOpenRef.current = false;
			setWarningOpen(false);
			return undefined;
		}

		scheduleIdle();
		ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
		const onVisibility = () => {
			if (document.visibilityState === 'visible') onActivity();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			clearTimers();
			ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [status, scheduleIdle, onActivity, clearTimers]);

	if (status !== 'authenticated') return null;

	const progress = Math.min(100, Math.max(0, (secondsLeft / (WARN_BEFORE_MS / 1000)) * 100));

	return (
		<Dialog
			open={warningOpen}
			onClose={() => undefined}
			disableEscapeKeyDown
			maxWidth="xs"
			fullWidth
			slotProps={{
				backdrop: {
					sx: {
						backgroundColor: alpha(theme.palette.common.black, 0.55),
						backdropFilter: 'blur(8px)'
					}
				},
				paper: {
					sx: {
						borderRadius: 3,
						overflow: 'hidden',
						boxShadow: `0 24px 64px ${alpha(theme.palette.common.black, 0.28)}`,
						border: `1px solid ${theme.palette.divider}`
					}
				}
			}}
		>
			<Box
				sx={{
					px: 3,
					pt: 3.5,
					pb: 1.5,
					background: `linear-gradient(160deg, ${alpha(theme.palette.warning.main, 0.14)} 0%, ${alpha(
						theme.palette.background.paper,
						1
					)} 55%)`
				}}
			>
				<Box className="flex flex-col items-center text-center gap-3">
					<Box sx={{ position: 'relative', display: 'inline-flex' }}>
						<CircularProgress
							variant="determinate"
							value={100}
							size={88}
							thickness={3}
							sx={{ color: alpha(theme.palette.warning.main, 0.18), position: 'absolute' }}
						/>
						<CircularProgress
							variant="determinate"
							value={progress}
							size={88}
							thickness={3}
							sx={{
								color: 'warning.main',
								'& .MuiCircularProgress-circle': { strokeLinecap: 'round' }
							}}
						/>
						<Box
							sx={{
								top: 0,
								left: 0,
								bottom: 0,
								right: 0,
								position: 'absolute',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								flexDirection: 'column'
							}}
						>
							<Typography variant="h6" fontWeight={800} color="text.primary" lineHeight={1}>
								{formatCountdown(secondsLeft)}
							</Typography>
						</Box>
					</Box>

					<Box
						sx={{
							width: 44,
							height: 44,
							borderRadius: 2,
							display: 'grid',
							placeItems: 'center',
							bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.22 : 0.16),
							color: 'warning.dark'
						}}
					>
						<FuseSvgIcon size={24}>heroicons-outline:clock</FuseSvgIcon>
					</Box>

					<Box>
						<Typography variant="h6" fontWeight={800} letterSpacing="-0.02em">
							Still there?
						</Typography>
						<Typography variant="body2" color="text.secondary" className="mt-1" sx={{ maxWidth: 320, mx: 'auto' }}>
							You’ve been inactive for a while. For your security we’ll sign you out unless you
							continue.
						</Typography>
					</Box>
				</Box>
			</Box>

			<Box className="flex flex-col gap-2 px-3 pb-3 pt-2 sm:flex-row-reverse sm:gap-2">
				<Button
					fullWidth
					variant="contained"
					color="primary"
					disabled={signingOut}
					onClick={staySignedIn}
					sx={{ textTransform: 'none', fontWeight: 700, py: 1.15, borderRadius: 2 }}
				>
					Stay signed in
				</Button>
				<Button
					fullWidth
					variant="outlined"
					color="inherit"
					disabled={signingOut}
					onClick={() => void doSignOut()}
					sx={{ textTransform: 'none', fontWeight: 600, py: 1.15, borderRadius: 2 }}
				>
					{signingOut ? 'Signing out…' : 'Sign out now'}
				</Button>
			</Box>
		</Dialog>
	);
}
