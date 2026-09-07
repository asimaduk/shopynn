import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { BaseQueryFn, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta } from '@reduxjs/toolkit/query';
import { API_BASE_URL } from '@/utils/apiFetch';
import { getSession } from 'next-auth/react';

export const globalHeaders: Record<string, string> = {}
const SUBSCRIPTION_GATE_CODES = new Set([
	'SUBSCRIPTION_EXPIRED',
	'SUBSCRIPTION_REQUIRED',
	'SUBSCRIPTION_NOT_STARTED',
	'SUBSCRIPTION_INACTIVE',
	'FEATURE_NOT_AVAILABLE',
	'SUBSCRIPTION_FEATURES_UNKNOWN'
]);

const rawBaseQuery = fetchBaseQuery({
	baseUrl: API_BASE_URL,
	prepareHeaders: async (headers) => {
		const session = await getSession();
		globalHeaders.Authorization = `Bearer ${session.accessToken}`;

		Object.entries(globalHeaders).forEach(([key, value]) => {
			headers.set(key, value);
		});
		return headers;
	}
});

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, object, FetchBaseQueryMeta> = async (
	args,
	api,
	extraOptions
) => {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		return {
			error: {
				status: 'FETCH_ERROR',
				error: 'OFFLINE'
			} as FetchBaseQueryError
		};
	}

	const result = await rawBaseQuery(args, api, extraOptions);

	// Centralized handling for auth/subscription/feature denials.
	if (result.error && result.error.status === 401) {
		// Logic to handle 401 errors (e.g., refresh token)
	}
	if (result.error && (result.error.status === 403 || result.error.status === 402)) {
		const data = (result.error as FetchBaseQueryError & { data?: any })?.data;
		const code = String(
			data?.code || data?.error?.code || data?.data?.code || ''
		).toUpperCase();
		if (SUBSCRIPTION_GATE_CODES.has(code)) {
			api.dispatch(
				{
					type: 'fuseMessage/showMessage',
					payload: {
						variant: 'warning',
						autoHideDuration: 5000,
						message: code === 'FEATURE_NOT_AVAILABLE'
							? 'This feature is not included in your current plan. Review plans in your profile.'
							: 'Subscription access is required to continue. Review billing in your profile.'
					}
				}
			);
			if (
				typeof window !== 'undefined' &&
				!window.location.pathname.startsWith('/apps/profile') &&
				!window.location.pathname.startsWith('/subscription')
			) {
				window.setTimeout(() => {
					if (
						!window.location.pathname.startsWith('/apps/profile') &&
						!window.location.pathname.startsWith('/subscription')
					) {
						window.location.assign('/apps/profile');
					}
				}, 400);
			}
		}
	}

	// console.log('API RESULT',result);
	// console.log('api url',result.meta.request.url);
	if((result.data?.['status'] === 200) || (result.data?.['data'])) {
		return {data: result.data?.['data']};
	}
	
	return result;
};

export const apiService = createApi({
	baseQuery,
	refetchOnReconnect: true,
	endpoints: () => ({}),
	reducerPath: 'apiService'
});

export default apiService;
