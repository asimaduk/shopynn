import { createTransform } from 'redux-persist';

const POS_PRODUCTS_ENDPOINT = 'getECommerceProductsWithPagination';

/** Keep only POS catalog query entries + drop volatile RTK fields (used on persist + one-time migrate). */
export function slimApiServiceForOfflineCatalog(inboundState: unknown): unknown {
	if (!inboundState || typeof inboundState !== 'object') {
		return inboundState;
	}
	const s = inboundState as Record<string, unknown>;
	const queries = s.queries as Record<string, unknown> | undefined;
	if (!queries) return inboundState;

	const nextQueries: Record<string, unknown> = {};
	for (const [qKey, qVal] of Object.entries(queries)) {
		const q = qVal as { endpointName?: string } | null;
		if (!q || q.endpointName !== POS_PRODUCTS_ENDPOINT) continue;
		// New Sale uses { pageType: 'pos' }; avoid persisting unrelated paginated product lists.
		if (!/"pageType"\s*:\s*"pos"/.test(qKey) && !/'pageType'\s*:\s*'pos'/.test(qKey)) continue;
		nextQueries[qKey] = qVal;
	}

	return {
		...s,
		queries: nextQueries,
		mutations: {},
		subscriptions: {}
	};
}

export const apiServicePersistTransform = createTransform(
	(inboundState: unknown, key: string) => {
		if (key !== 'apiService') return inboundState;
		return slimApiServiceForOfflineCatalog(inboundState);
	},
	(outboundState: unknown) => outboundState,
	{ whitelist: ['apiService'] }
);
