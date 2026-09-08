import type { Metadata } from 'next';

async function generateMetadata(meta: {
	title: string;
	description: string;
	cardImage: string;
	robots: string;
	favicon: string;
	url: string;
}): Promise<Metadata> {
	return {
		applicationName: meta.title,
		title: meta.title,
		description: meta.description,
		referrer: 'origin-when-cross-origin',
		keywords: ['ims-ghana', 'ims', 'shopynn'],
		authors: [{ name: 'Kingsford', url: '' }],
		creator: 'Kingsford',
		publisher: 'Kingsford',
		robots: meta.robots,
		icons: {
			icon: [
				{ url: '/favicon.ico', sizes: 'any' },
				{ url: '/favicon.svg', type: 'image/svg+xml' },
				{ url: meta.favicon, type: 'image/png', sizes: '32x32' }
			],
			apple: '/apple-touch-icon.png'
		},
		appleWebApp: {
			capable: true,
			statusBarStyle: 'default',
			title: meta.title
		},
		formatDetection: {
			telephone: false
		}
	};
}

export default generateMetadata;
