'use client';

import { useEffect } from 'react';

/**
 * Clears the legacy next-pwa service worker (/sw.js) and its caches so the
 * Serwist worker at /serwist/sw.js can take over cleanly.
 */
export default function LegacyServiceWorkerCleanup() {
	useEffect(() => {
		if (!('serviceWorker' in navigator)) return;

		void (async () => {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(
				registrations.map(async (registration) => {
					const scriptUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || '';
					if (scriptUrl.endsWith('/sw.js') && !scriptUrl.includes('/serwist/')) {
						await registration.unregister();
					}
				})
			);

			if ('caches' in window) {
				const keys = await caches.keys();
				await Promise.all(
					keys
						.filter((key) => key.startsWith('workbox-') || key === 'pages' || key === 'start-url' || key === 'dev')
						.map((key) => caches.delete(key))
				);
			}
		})();
	}, []);

	return null;
}
