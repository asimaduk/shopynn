'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { marketingSiteUrl } from '@/@auth/signOutUrl';

/**
 * One-click demo: NextAuth credentials mode=demo → API /demo/enter → dashboard.
 */
export default function DemoEnterClient() {
	const [error, setError] = useState<string | null>(null);
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;

		void (async () => {
			try {
				const result = await signIn('credentials', {
					mode: 'demo',
					redirect: false
				});
				if (result?.error || !result?.ok) {
					setError('Could not open the demo shop. Try again in a moment, or start a free account.');
					return;
				}
				window.location.assign('/dashboards/analytics');
			} catch {
				setError('Could not open the demo shop. Try again in a moment, or start a free account.');
			}
		})();
	}, []);

	if (error) {
		return (
			<Box className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
				<Typography variant="h5" className="font-semibold">
					Demo unavailable
				</Typography>
				<Typography color="text.secondary" className="max-w-md">
					{error}
				</Typography>
				<Box className="flex flex-wrap justify-center gap-2">
					<Button variant="contained" onClick={() => window.location.reload()}>
						Retry
					</Button>
					<Button variant="outlined" href={marketingSiteUrl('/start-trial')}>
						Start free
					</Button>
					<Button variant="text" href="/sign-in">
						Sign in
					</Button>
				</Box>
			</Box>
		);
	}

	return (
		<Box className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
			<CircularProgress size={28} />
			<Typography variant="body2" color="text.secondary">
				Entering demo shop…
			</Typography>
		</Box>
	);
}
