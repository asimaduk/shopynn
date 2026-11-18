'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import CardContent from '@mui/material/CardContent';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
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

function DemoShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen min-w-0 flex-1 flex-col items-center sm:flex-row sm:justify-center md:items-start md:justify-start">
			<Paper className="h-full w-full px-4 py-8 ltr:border-r-1 rtl:border-l-1 sm:h-auto sm:w-auto sm:rounded-xl sm:p-12 sm:shadow-sm md:flex md:h-full md:w-1/2 md:items-center md:justify-end md:rounded-none md:p-16 md:shadow-none">
				<CardContent className="mx-auto w-full max-w-80 sm:mx-0 sm:w-80">{children}</CardContent>
			</Paper>

			<Box
				className="relative hidden h-full flex-auto items-center justify-center overflow-hidden p-16 md:flex lg:px-28"
				sx={{ backgroundColor: 'primary.dark', color: 'primary.contrastText' }}
			>
				<svg
					className="pointer-events-none absolute inset-0"
					viewBox="0 0 960 540"
					width="100%"
					height="100%"
					preserveAspectRatio="xMidYMax slice"
					xmlns="http://www.w3.org/2000/svg"
				>
					<Box
						component="g"
						className="opacity-5"
						fill="none"
						stroke="currentColor"
						strokeWidth="100"
					>
						<circle r="234" cx="196" cy="23" />
						<circle r="234" cx="790" cy="491" />
					</Box>
				</svg>
				<div className="relative z-10 w-full max-w-4xl">
					<div className="text-7xl font-bold leading-none text-gray-100">
						<div>Try Shopynn</div>
						<div>in a live shop</div>
					</div>
					<div className="mt-6 max-w-xl text-lg leading-6 tracking-tight text-gray-400">
						Explore sales, stock, and reports in our shared demo store — no signup, no real money.
					</div>
				</div>
			</Box>
		</div>
	);
}

/**
 * One-click demo: NextAuth credentials mode=demo → API /demo/enter → dashboard.
 */
export default function DemoEnterClient() {
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState('Opening the demo shop…');
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
				setStatus('Opening the demo shop…');
				const result = await signIn('credentials', {
					mode: 'demo',
					...(captcha_token ? { captcha_token } : {}),
					redirect: false
				});
				if (result?.error || !result?.ok) {
					setError(
						'The live demo is temporarily offline while we refresh the sandbox. You can try again shortly, or create your own shop in a couple of minutes.'
					);
					return;
				}
				window.location.assign('/dashboards/analytics');
			} catch {
				setError(
					'The live demo is temporarily offline while we refresh the sandbox. You can try again shortly, or create your own shop in a couple of minutes.'
				);
			}
		})();
	}, []);

	if (error) {
		return (
			<DemoShell>
				<img className="w-14" src="/assets/images/logo/shopynn-icon.png" alt="Shopynn" />
				<Box
					className="mt-8 flex h-12 w-12 items-center justify-center rounded-full"
					sx={{ bgcolor: 'error.main', color: 'error.contrastText', opacity: 0.9 }}
				>
					<FuseSvgIcon size={24}>heroicons-outline:exclamation-triangle</FuseSvgIcon>
				</Box>
				<Typography className="mt-6 text-4xl font-extrabold leading-[1.2] tracking-tight">
					Demo unavailable
				</Typography>
				<Typography className="mt-3 text-md leading-relaxed" color="text.secondary">
					{error}
				</Typography>
				<div className="mt-8 flex flex-col gap-3">
					<Button
						variant="contained"
						color="secondary"
						className="w-full"
						size="large"
						onClick={() => window.location.reload()}
					>
						Try again
					</Button>
					<Button
						variant="outlined"
						className="w-full"
						size="large"
						href={marketingSiteUrl('/start-trial')}
					>
						Start free shop
					</Button>
					<Button variant="text" className="w-full" href="/sign-in">
						Sign in instead
					</Button>
				</div>
				<Typography className="mt-8 text-sm" color="text.disabled">
					Already exploring with a field agent? Ask them for the private demo sign-in.
				</Typography>
			</DemoShell>
		);
	}

	return (
		<DemoShell>
			<img className="w-14" src="/assets/images/logo/shopynn-icon.png" alt="Shopynn" />
			<Typography className="mt-8 text-4xl font-extrabold leading-[1.2] tracking-tight">
				Live demo
			</Typography>
			<Typography className="mt-3 text-md leading-relaxed" color="text.secondary">
				Signing you into Shopynn Demo Store so you can click around a real shop — sales, stock, and
				reports included.
			</Typography>
			<Box className="mt-10 flex items-center gap-3">
				<CircularProgress size={22} color="secondary" />
				<Typography variant="body2" color="text.secondary">
					{status}
				</Typography>
			</Box>
			{TURNSTILE_SITE_KEY ? <div ref={captchaRef} className="mt-6 min-h-[65px]" /> : null}
		</DemoShell>
	);
}
