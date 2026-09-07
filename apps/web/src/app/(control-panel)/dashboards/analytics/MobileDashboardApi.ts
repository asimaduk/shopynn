import { apiService as api } from 'src/store/apiService';

export type DashboardResponse = Record<string, any>;
export type InventoryItem = Record<string, any>;

const MobileDashboardApi = api.injectEndpoints({
	endpoints: (build) => ({
		getDashboard: build.query<DashboardResponse | null, { recentLimit?: number } | void>({
			query: (arg) => {
				const recentLimit = typeof (arg as any)?.recentLimit === 'number' ? (arg as any).recentLimit : 5;
				return { url: '/api/dashboard', params: { recentLimit } as any };
			}
		}),
		getLowStock: build.query<InventoryItem[], void>({
			query: () => ({ url: '/api/inventories/low-stock' }),
			transformResponse: (raw: any) => {
				const data = raw?.data ?? raw;
				if (Array.isArray(data)) return data;
				if (Array.isArray(data?.data)) return data.data;
				return [];
			}
		}),
		getExpiring: build.query<InventoryItem[], { days?: number } | void>({
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

export const { useGetDashboardQuery, useGetLowStockQuery, useGetExpiringQuery } = MobileDashboardApi;

export default MobileDashboardApi;

