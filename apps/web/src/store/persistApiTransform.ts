import { createTransform } from 'redux-persist';

const POS_PRODUCTS_ENDPOINT = 'getECommerceProductsWithPagination';

type PersistedQuery = {
	endpointName?: string;
	status?: string;
	data?: unknown;
	requestId?: string;
	startedTimeStamp?: number;
};

/**
 * A query saved mid-request must not come back as "pending": RTK Query treats it as already
 * in flight and never refetches, leaving the catalog (and its stock counts) stale.
 */
function settleQuery(q: PersistedQuery): PersistedQuery | null {
	if (q.status !== 'pending') return q;
	if (q.data === undefined) return null;
	const { requestId: _requestId, startedTimeStamp: _started, ...rest } = q;
	return { ...rest, status: 'fulfilled' };
}

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
		const q = qVal as PersistedQuery | null;
		if (!q || q.endpointName !== POS_PRODUCTS_ENDPOINT) continue;
		// New Sale uses { pageType: 'pos' }; avoid persisting unrelated paginated product lists.
		if (!/"pageType"\s*:\s*"pos"/.test(qKey) && !/'pageType'\s*:\s*'pos'/.test(qKey)) continue;
		const settled = settleQuery(q);
		if (settled) nextQueries[qKey] = settled;
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
	(outboundState: unknown, key: string) => {
		if (key !== 'apiService') return outboundState;
		return slimApiServiceForOfflineCatalog(outboundState);
	},
	{ whitelist: ['apiService'] }
);
