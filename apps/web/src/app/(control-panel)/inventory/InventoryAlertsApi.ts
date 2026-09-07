import { apiService as api } from 'src/store/apiService';

export type LowStockItem = Record<string, any>;
export type ExpiringItem = Record<string, any>;

const InventoryAlertsApi = api.injectEndpoints({
	endpoints: (build) => ({
		getLowStockItems: build.query<LowStockItem[], void>({
			query: () => ({ url: '/api/inventories/low-stock' }),
			transformResponse: (raw: any) => {
				const data = raw?.data ?? raw;
				if (Array.isArray(data)) return data;
				if (Array.isArray(data?.data)) return data.data;
				return [];
			}
		}),
		getExpiringItems: build.query<ExpiringItem[], { days?: number } | void>({
			query: (arg) => {
				const days = typeof (arg as any)?.days === 'number' ? (arg as any).days : 30;
				return { url: '/api/inventories/expiring', params: { days } as any };
			},
			transformResponse: (raw: any) => {
				const data = raw?.data ?? raw;
				if (Array.isArray(data)) return data;
				if (Array.isArray(data?.data)) return data.data;
				return [];
			}
		})
	}),
	overrideExisting: false
});

export const { useGetLowStockItemsQuery, useGetExpiringItemsQuery } = InventoryAlertsApi;

export default InventoryAlertsApi;

