import { apiService as api } from 'src/store/apiService';
import type { StockCountRecord } from './stockCountListData';

/** Raw row from `GET /api/stock-counts` — `ims-services` `getStockCountsHistoryService`. */
export type StockCountApiRow = {
	id: string;
	warehouse_id?: string;
	reference_number?: string | null;
	status?: string | null;
	number_of_items?: number | null;
	notes?: string | null;
	created_at?: string;
	warehouse_name?: string | null;
	creator_first_name?: string | null;
	creator_last_name?: string | null;
	variance?: number | null;
};

export type ListStockCountsArg = {
	startDate?: string;
	endDate?: string;
	warehouse_id?: string;
	search?: string;
};

/** Product line for new stock count — mapped from `GET /api/products?warehouse_id=` (parity with mobile). */
export type StockCountProductLine = {
	id: string;
	name: string;
	sku: string;
	currentStock: number;
	inventoryId: string | null;
};

export type CreateStockCountPayload = {
	warehouse_id: string;
	reference_number?: string;
	notes?: string;
	status?: string;
	items: Array<{
		product_id: string;
		inventory_id?: string | null;
		expected_quantity: number;
		counted_quantity: number;
	}>;
};

function normalizeList(raw: unknown): StockCountApiRow[] {
	if (Array.isArray(raw)) return raw as StockCountApiRow[];
	if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
		return (raw as { data: StockCountApiRow[] }).data;
	}
	return [];
}

function normalizeStatus(s: string | null | undefined): StockCountRecord['status'] {
	const x = String(s || '').toLowerCase();
	if (x.includes('complete')) return 'completed';
	if (x.includes('progress')) return 'in_progress';
	if (x.includes('schedule')) return 'scheduled';
	return 'completed';
}

export function mapStockCountRow(row: StockCountApiRow): StockCountRecord {
	const n = Number(row.number_of_items ?? 0);
	const conductedBy = [row.creator_first_name, row.creator_last_name].filter(Boolean).join(' ').trim();
	return {
		id: row.id,
		date: row.created_at ? String(row.created_at) : new Date().toISOString(),
		warehouse: row.warehouse_name?.trim() || '—',
		productCount: n,
		itemsCounted: n,
		variance: row.variance,
		status: normalizeStatus(row.status),
		conductedBy: conductedBy || '—',
		referenceNumber: row.reference_number ?? undefined
	};
}

function mapProductToStockLine(p: Record<string, unknown>, warehouseId: string): StockCountProductLine {
	const sq = (p.stores_quantities as
		| Array<{ id?: string; quantity_available?: number; warehouse_id?: string }>
		| undefined) ?? [];
	const match = sq.find((s) => String(s.warehouse_id ?? '') === warehouseId);
	const row = match ?? sq[0];
	const invId = row?.id ? String(row.id) : null;
	const fromStores = Number(row?.quantity_available ?? NaN);
	const inv = Number(p.inventory ?? 0);
	const currentStock = row ? (Number.isFinite(fromStores) ? fromStores : 0) : inv;
	return {
		id: String(p.id ?? ''),
		name: String(p.name ?? '—'),
		sku: String(p.sku ?? ''),
		currentStock,
		inventoryId: invId
	};
}

function normalizeProductList(raw: unknown, warehouseId: string): StockCountProductLine[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.map((r) => mapProductToStockLine(r as Record<string, unknown>, warehouseId))
		.filter((x) => x.id);
}

const StockCountApi = api
	.enhanceEndpoints({
		addTagTypes: ['stock_counts']
	})
	.injectEndpoints({
		endpoints: (build) => ({
			listStockCounts: build.query<StockCountRecord[], ListStockCountsArg | undefined>({
				query: (arg) => {
					const params: Record<string, string> = {};
					if (arg?.startDate) params.startDate = arg.startDate;
					if (arg?.endDate) params.endDate = arg.endDate;
					if (arg?.warehouse_id) params.warehouse_id = arg.warehouse_id;
					if (arg?.search?.trim()) params.search = arg.search.trim();
					return { url: '/api/stock-counts', params };
				},
				transformResponse: (raw: unknown) => normalizeList(raw).map(mapStockCountRow),
				providesTags: ['stock_counts']
			}),
			/** Products scoped to a warehouse — same contract as mobile `products.list({ warehouse_id })`. */
			getProductsForStockCount: build.query<StockCountProductLine[], { warehouse_id: string }>({
				query: ({ warehouse_id }) => ({
					url: '/api/products',
					params: {
						warehouse_id,
						pageNumber: 1,
						pageSize: 5000
					}
				}),
				transformResponse: (raw: unknown, _meta, arg: { warehouse_id: string }) =>
					normalizeProductList(raw, arg.warehouse_id)
			}),
			createStockCount: build.mutation<unknown, CreateStockCountPayload>({
				query: (body) => ({
					url: '/api/stock-counts',
					method: 'POST',
					body: {
						warehouse_id: body.warehouse_id,
						reference_number: body.reference_number?.trim() || undefined,
						notes: body.notes?.trim() || undefined,
						status: body.status ?? 'Completed',
						items: body.items
					}
				}),
				invalidatesTags: ['stock_counts']
			})
		}),
		overrideExisting: false
	});

export const {
	useListStockCountsQuery,
	useGetProductsForStockCountQuery,
	useCreateStockCountMutation
} = StockCountApi;

export default StockCountApi;
