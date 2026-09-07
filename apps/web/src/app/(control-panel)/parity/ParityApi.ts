import { apiService as api } from 'src/store/apiService';

type PurchaseOrderLine = {
	id: string;
	name: string;
	qty: number;
	unitCost: number;
};

export type PurchaseOrder = {
	id: string;
	reference: string;
	supplier?: string;
	status?: 'draft' | 'sent' | 'received';
	createdAt?: string;
	lines?: PurchaseOrderLine[];
};

const PO_STORAGE_KEY = 'IMS_WEB_PURCHASE_ORDERS_V1';

function safeParse<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function loadPurchaseOrders(): PurchaseOrder[] {
	if (typeof window === 'undefined') return [];
	const list = safeParse<PurchaseOrder[]>(window.localStorage.getItem(PO_STORAGE_KEY));
	return Array.isArray(list) ? list : [];
}

function savePurchaseOrders(list: PurchaseOrder[]) {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(PO_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

const ParityApi = api.injectEndpoints({
	endpoints: (build) => ({
		getPurchaseOrders: build.query<any, void>({
			queryFn: async () => {
				const list = loadPurchaseOrders();
				return { data: list };
			}
		}),
		createPurchaseOrder: build.mutation<any, any>({
			queryFn: async (body) => {
				const list = loadPurchaseOrders();
				const reference = String(body?.reference || '').trim();
				const po: PurchaseOrder = {
					id: `PO-${Date.now()}`,
					reference: reference || `PO-${Date.now()}`,
					supplier: body?.supplier,
					status: 'draft',
					createdAt: new Date().toISOString(),
					lines: Array.isArray(body?.lines) ? body.lines : []
				};
				savePurchaseOrders([po, ...list]);
				return { data: po };
			}
		}),
		getPurchaseOrderById: build.query<any, string>({
			queryFn: async (id) => {
				const list = loadPurchaseOrders();
				const hit = list.find((x) => String(x.id) === String(id));
				return { data: hit || null };
			}
		}),
		receivePurchaseOrder: build.mutation<any, { id: string; body?: any }>({
			queryFn: async ({ id }) => {
				const list = loadPurchaseOrders();
				const next = list.map((x) => (String(x.id) === String(id) ? { ...x, status: 'received' as const } : x));
				savePurchaseOrders(next);
				const updated = next.find((x) => String(x.id) === String(id)) || null;
				return { data: updated };
			}
		}),
		getReceiptSettings: build.query<any, void>({
			query: () => ({ url: '/api/users/me/preferences' })
		}),
		updateReceiptSettings: build.mutation<any, any>({
			query: (body) => ({ url: '/api/users/me/preferences', method: 'PUT', body })
		}),
		runDataExport: build.query<any, void>({
			query: () => ({ url: '/api/products/export' })
		})
	}),
	overrideExisting: false
});

export const {
	useGetPurchaseOrdersQuery,
	useCreatePurchaseOrderMutation,
	useGetPurchaseOrderByIdQuery,
	useReceivePurchaseOrderMutation,
	useGetReceiptSettingsQuery,
	useUpdateReceiptSettingsMutation,
	useLazyRunDataExportQuery
} = ParityApi;

export default ParityApi;
