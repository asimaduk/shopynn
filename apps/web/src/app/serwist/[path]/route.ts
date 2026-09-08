import { spawnSync } from 'node:child_process';
import { createSerwistRoute } from '@serwist/turbopack';

const gitRevision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim();
const revision = gitRevision || crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
	additionalPrecacheEntries: [
		{ url: '/~offline', revision },
		{ url: '/manifest.webmanifest', revision }
	],
	swSrc: 'src/app/sw.ts',
	useNativeEsbuild: true,
	// Avoid bloating install with Fuse/MUI demo assets under public/
	globIgnores: [
		'**/node_modules/**/*',
		'**/material-ui-static/**/*',
		'**/assets/fonts/meteocons/demo*/**',
		'**/assets/fonts/meteocons/demo.html',
		'**/assets/fonts/meteocons/Read Me.txt',
		'**/assets/fonts/meteocons/selection.json'
	]
});
