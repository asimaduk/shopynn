import { withSerwist } from '@serwist/turbopack';

/** @type {import('next').NextConfig} */
const securityHeaders = [
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	// Microphone is used by voice product search.
	{ key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' }
];

const nextConfig = {
	reactStrictMode: true,
	poweredByHeader: false,
	typescript: {
		// Dangerously allow production builds to successfully complete even if
		// your project has type errors.
		ignoreBuildErrors: true
	},
	turbopack: {
		resolveAlias: {
			// Silence client-side imports of Node built-ins (formerly webpack resolve.fallback)
			fs: {
				browser: './empty.js'
			}
		}
	},
	headers: async () => [
		{
			source: '/:path*',
			headers: securityHeaders
		},
		{
			source: '/serwist/:path*',
			headers: [
				{
					key: 'Cache-Control',
					value: 'no-cache, no-store, must-revalidate'
				},
				{
					key: 'Service-Worker-Allowed',
					value: '/'
				}
			]
		},
		{
			source: '/manifest.webmanifest',
			headers: [
				{
					key: 'Cache-Control',
					value: 'public, max-age=0, must-revalidate'
				}
			]
		}
	]
};

export default withSerwist(nextConfig);
