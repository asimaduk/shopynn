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
			icon: meta.favicon,
			apple: '/assets/icons/icon-192.png'
		},
		appleWebApp: {
			capable: true,
			statusBarStyle: 'default',
			title: meta.title
		},
		formatDetection: {
			telephone: false
		},
		// metadataBase: new URL(meta.url),
		// openGraph: {
		// 	url: meta.url,
		// 	title: meta.title,
		// 	description: meta.description,
		// 	images: [meta.cardImage],
		// 	type: 'website',
		// 	siteName: meta.title
		// },
		// twitter: {
		// 	card: 'summary_large_image',
		// 	site: '@FuseTech',
		// 	creator: '@FuseTech',
		// 	title: meta.title,
		// 	description: meta.description,
		// 	images: [meta.cardImage]
		// }
	};
}

export default generateMetadata;
