import clsx from 'clsx';
import type { Viewport } from 'next';
import 'src/styles/splash-screen.css';
import 'src/styles/index.css';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@auth/authJs';
import generateMetadata from '../utils/generateMetadata';
import App from './App';
import { SerwistProvider } from './serwist-provider';
import LegacyServiceWorkerCleanup from '../components/LegacyServiceWorkerCleanup';

// eslint-disable-next-line react-refresh/only-export-components
export const metadata = await generateMetadata({
	title: 'Shopynn',
	description: 'Inventory Management System - Ghana',
	cardImage: '/card.png',
	robots: 'follow, index',
	favicon: '/favicon-32.png',
	url: ''
});

// eslint-disable-next-line react-refresh/only-export-components
export const viewport: Viewport = {
	themeColor: '#0F172A',
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover'
};

export default async function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth();
	const enableSw = process.env.NODE_ENV === 'production';

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta
					name="apple-mobile-web-app-capable"
					content="yes"
				/>
				<meta
					name="apple-mobile-web-app-status-bar-style"
					content="default"
				/>
				<meta
					name="apple-mobile-web-app-title"
					content="Shopynn"
				/>
				<meta
					name="mobile-web-app-capable"
					content="yes"
				/>
				<base href="/" />

				<link
					rel="apple-touch-icon"
					href="/apple-touch-icon.png"
				/>
				<link
					rel="shortcut icon"
					href="/favicon-32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32.png"
				/>

				<link
					href="/assets/fonts/material-design-icons/MaterialIconsOutlined.css"
					rel="stylesheet"
				/>
				<link
					href="/assets/fonts/inter/inter.css"
					rel="stylesheet"
				/>
				<link
					href="/assets/fonts/meteocons/style.css"
					rel="stylesheet"
				/>
				<link
					href="/assets/styles/prism.css"
					rel="stylesheet"
				/>
				<noscript id="emotion-insertion-point" />
			</head>
			<body
				id="root"
				className={clsx('loading')}
			>
				<SerwistProvider
					swUrl="/serwist/sw.js"
					disable={!enableSw}
				>
					<LegacyServiceWorkerCleanup />
					<SessionProvider
						basePath="/auth"
						session={session}
					>
						<App>{children}</App>
					</SessionProvider>
				</SerwistProvider>
			</body>
		</html>
	);
}
