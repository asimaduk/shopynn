import { apiService as api } from 'src/store/apiService';
import type { AdjustmentRecord } from './adjustmentHistoryData';

export type AdjustmentApiRow = {
	id: string;
	reference_number?: string | null;
	created_at?: string;
	warehouse_name?: string | null;
	number_of_items?: number | null;
	notes?: string | null;
	products?: unknown[];
	creator_first_name?: string | null;
	creator_last_name?: string | null;
};

export type ListAdjustmentsArg = {
	startDate?: string;
	endDate?: string;
	search?: string;
};

export type CreateAdjustmentPayload = {
	warehouse_id: string;
	reference_number?: string;
	notes: string;
	products: Array<{
		id: string;
		quantity: number;
		unit_price: number;
		adjustment_type?: string;
		category?: number;
		comment?: string;
	}>;
};

function normalizeList(raw: unknown): AdjustmentApiRow[] {
	if (Array.isArray(raw)) return raw as AdjustmentApiRow[];
	if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
		return (raw as { data: AdjustmentApiRow[] }).data;
	}
	return [];
}

export function mapAdjustmentRow(row: AdjustmentApiRow): AdjustmentRecord {
	const n = row.number_of_items ?? (Array.isArray(row.products) ? row.products.length : 0);
	return {
		id: row.id,
		reference: row.reference_number?.trim() || '—',
		date: row.created_at ? String(row.created_at) : new Date().toISOString(),
		warehouse: row.warehouse_name?.trim() || '—',
		productsCount: Number(n) || 0,
		notes: row.notes ?? '',
		createdBy: row.creator_first_name?.trim() + ' ' + row.creator_last_name?.trim() || '—'
	};
}

const AdjustmentApi = api
	.enhanceEndpoints({
		addTagTypes: ['adjustments']
	})
	.injectEndpoints({
		endpoints: (build) => ({
			listAdjustments: build.query<AdjustmentRecord[], ListAdjustmentsArg | undefined>({
				query: (arg) => {
					const params: Record<string, string> = {};
					if (arg?.startDate) params.startDate = arg.startDate;
					if (arg?.endDate) params.endDate = arg.endDate;
					if (arg?.search?.trim()) params.search = arg.search.trim();
					return { url: '/api/adjustments', params };
				},
				transformResponse: (raw: unknown) => normalizeList(raw).map(mapAdjustmentRow),
				providesTags: ['adjustments']
			}),
			createAdjustment: build.mutation<unknown, CreateAdjustmentPayload>({
				query: (body) => ({
					url: '/api/adjustments',
					method: 'POST',
					body
				}),
				invalidatesTags: ['adjustments']
			})
		}),
		overrideExisting: false
	});

export const { useListAdjustmentsQuery, useCreateAdjustmentMutation } = AdjustmentApi;

export default AdjustmentApi;
