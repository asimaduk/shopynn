import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: 'Shopynn — Inventory Management',
		short_name: 'Shopynn',
		description: 'Inventory Management System - Ghana',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		orientation: 'any',
		theme_color: '#0F172A',
		background_color: '#ffffff',
		categories: ['business', 'productivity'],
		icons: [
			{
				src: '/assets/icons/icon-192.png',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/assets/icons/icon-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/assets/icons/icon-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		]
	};
}
