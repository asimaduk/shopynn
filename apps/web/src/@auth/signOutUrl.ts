/**
 * Absolute sign-in URL for Auth.js signOut redirects.
 * Relative `/sign-in` is resolved against AUTH_URL/NEXTAUTH_URL — if those still
 * point at an old Vercel hostname (e.g. shopynn-web), logout lands on a 404.
 */
export function signInCallbackUrl(search = ''): string {
	const qs = search ? (search.startsWith('?') ? search : `?${search}`) : '';
	const path = `/sign-in${qs}`;
	if (typeof window !== 'undefined' && window.location?.origin) {
		return `${window.location.origin}${path}`;
	}
	const base = (
		process.env.AUTH_URL ||
		process.env.NEXTAUTH_URL ||
		process.env.NEXT_PUBLIC_BASE_URL ||
		''
	).replace(/\/$/, '');
	return base ? `${base}${path}` : path;
}

/** Marketing site origin (Try live demo / Start free). */
export function marketingSiteUrl(path = '/'): string {
	const base = (
		process.env.NEXT_PUBLIC_MARKETING_SITE_URL ||
		(process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : 'https://shopynn.app')
	).replace(/\/$/, '');
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${base}${p === '/' ? '' : p}` || base;
}
