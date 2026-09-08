import { withSerwist } from '@serwist/turbopack';

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
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
