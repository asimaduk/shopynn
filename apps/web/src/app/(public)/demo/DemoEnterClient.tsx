'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { marketingSiteUrl } from '@/@auth/signOutUrl';

const TURNSTILE_SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim();

declare global {
	interface Window {
		turnstile?: {
			render: (
				el: HTMLElement,
				opts: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void }
			) => string;
			remove: (id: string) => void;
		};
	}
}

function loadTurnstile(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if (window.turnstile) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const existing = document.querySelector('script[data-shopynn-turnstile]');
		if (existing) {
			existing.addEventListener('load', () => resolve());
			existing.addEventListener('error', () => reject(new Error('captcha load failed')));
			return;
		}
		const s = document.createElement('script');
		s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		s.async = true;
		s.dataset.shopynnTurnstile = '1';
		s.onload = () => resolve();
		s.onerror = () => reject(new Error('captcha load failed'));
		document.head.appendChild(s);
	});
}

async function solveCaptcha(container: HTMLElement): Promise<string> {
	await loadTurnstile();
	if (!window.turnstile) throw new Error('captcha unavailable');
	return new Promise((resolve, reject) => {
		const id = window.turnstile!.render(container, {
			sitekey: TURNSTILE_SITE_KEY,
			callback: (token) => resolve(token),
			'error-callback': () => reject(new Error('captcha failed'))
		});
		void id;
	});
}

/**
 * One-click demo: NextAuth credentials mode=demo → API /demo/enter → dashboard.
 */
export default function DemoEnterClient() {
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState('Entering demo shop…');
	const started = useRef(false);
	const captchaRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (started.current) return;
		started.current = true;

		void (async () => {
			try {
				let captcha_token: string | undefined;
				if (TURNSTILE_SITE_KEY && captchaRef.current) {
					setStatus('Confirm you’re human…');
					captcha_token = await solveCaptcha(captchaRef.current);
				}
				setStatus('Entering demo shop…');
				const result = await signIn('credentials', {
					mode: 'demo',
					...(captcha_token ? { captcha_token } : {}),
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
				{status}
			</Typography>
			{TURNSTILE_SITE_KEY ? <div ref={captchaRef} className="mt-2 min-h-[65px]" /> : null}
		</Box>
	);
}
