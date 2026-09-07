import pwa from 'next-pwa';
const withPWA = pwa({
	dest: 'public',
	// disable: process.env.NODE_ENV === 'development',
	register: true,
	skipWaiting: true,
	// cacheOnFrontEndNav: true,
	// aggressiveFrontEndNavCaching: true,
	// reloadOnOnline: true,
	runtimeCaching: [
		{
			urlPattern: /^https?.*/,
			handler: 'NetworkFirst',
			options: {
				cacheName: 'pages',
				expiration: {
					maxEntries: 100,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
				},
			},
		},
	],
	// exclude: [
	// 	// Exclude app-build-manifest.json from precaching
	// 	({ asset, compilation }) => {
	// 	  return asset.name.startsWith('app-build-manifest.json');
	// 	},
	// ],
	// swcMinify: true,
	// chunks: true
	exclude: [
        // Exclude the build-manifest.json
        /build-manifest\.json$/,
		/react-loadable-manifest\.json$/,
		/font-manifest\.json$/,
		/client-reference-manifest\.js$/,
		/middleware-build-manifest\.js$/,
		/-react-loadable-manifest\.js$/,
		/next-font-manifest\.js$/,
		/\/_redirects/,
		'/_redirects',
		({ asset, compilation }) => {
			return asset.name.startsWith('/_redirects');
		},
        // Add other files or patterns to exclude if necessary
        // /\.map$/, // Example: exclude source maps
    ],
	// workboxOptions: {
	// 	// disableDevLogs: true
	// 	exclude: [/_redirects/]
	// },
	// pwa: {
	// 	workboxOptions: {
	// 		exclude: ['_redirects'],
	// 	}
	// }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	// reactStrictMode: false,
	reactStrictMode: true,
	eslint: {
		// Only enable ESLint in development
		ignoreDuringBuilds: process.env.NODE_ENV === 'production'
	},
	typescript: {
		// Dangerously allow production builds to successfully complete even if
		// your project has type errors.
		ignoreBuildErrors: true
	},
	webpack: (config, { isServer }) => {
		if (config.module && config.module.rules) {
			config.module.rules.push({
				test: /\.(json|js|ts|tsx|jsx)$/,
				resourceQuery: /raw/,
				use: 'raw-loader'
			});
		}

		if (!isServer) {
			config.resolve.fallback.fs = false;
		}

		return config;
	},
	// headers: ()=> {
	// 	return [
    //         {
    //             source: '/api/:path*', // Match all routes
    //             headers: [
    //                 { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
    //                 { key: 'Pragma', value: 'no-cache' },
    //                 { key: 'Expires', value: '0' },
    //             ],
    //         },
    //     ];
	// }
};

export default nextConfig;


// export default withPWA(nextConfig);
