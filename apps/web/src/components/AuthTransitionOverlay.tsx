'use client';

import { useEffect, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Fade from '@mui/material/Fade';
import {
	AUTH_TRANSITION_EVENT,
	endAuthTransition,
	getAuthTransition,
	type AuthTransitionState
} from 'src/utils/authTransition';

const SAFETY_TIMEOUT_MS = 12000;

/**
 * Full-screen branded loader that bridges sign-in → first permitted screen.
 */
function AuthTransitionOverlay() {
	const [state, setState] = useState<AuthTransitionState>(() =>
		typeof window === 'undefined' ? { active: false, message: 'Signing you in…' } : getAuthTransition()
	);

	useEffect(() => {
		const onChange = (event: Event) => {
			const detail = (event as CustomEvent<AuthTransitionState>).detail;
			if (detail) setState(detail);
			else setState(getAuthTransition());
		};

		window.addEventListener(AUTH_TRANSITION_EVENT, onChange);
		setState(getAuthTransition());

		return () => window.removeEventListener(AUTH_TRANSITION_EVENT, onChange);
	}, []);

	useEffect(() => {
		if (!state.active) return undefined;
		const timer = window.setTimeout(() => endAuthTransition(), SAFETY_TIMEOUT_MS);
		return () => window.clearTimeout(timer);
	}, [state.active]);

	return (
		<Backdrop
			open={state.active}
			sx={{
				zIndex: (theme) => theme.zIndex.modal + 2,
				backgroundColor: 'rgba(15, 23, 42, 0.72)',
				backdropFilter: 'blur(6px)'
			}}
		>
			<Fade in={state.active}>
				<Box
					role="status"
					aria-live="polite"
					aria-busy={state.active}
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 2.5,
						px: 4,
						py: 4,
						minWidth: 280,
						maxWidth: 360,
						borderRadius: 3,
						bgcolor: 'background.paper',
						boxShadow: 8,
						textAlign: 'center'
					}}
				>
					<img
						src="/assets/images/logo/shopynn-mark-nav.png"
						alt=""
						width={56}
						height={56}
						style={{ borderRadius: '50%' }}
					/>
					<Typography variant="h6" fontWeight={700} color="text.primary">
						Shopynn
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{state.message}
					</Typography>
					<Box
						id="spinner"
						sx={{
							mt: 0.5,
							'& > div': {
								backgroundColor: 'secondary.main'
							}
						}}
					>
						<div className="bounce1" />
						<div className="bounce2" />
						<div className="bounce3" />
					</Box>
				</Box>
			</Fade>
		</Backdrop>
	);
}

export default AuthTransitionOverlay;
