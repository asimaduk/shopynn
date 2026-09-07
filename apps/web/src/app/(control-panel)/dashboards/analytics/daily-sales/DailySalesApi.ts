import { apiService as api } from 'src/store/apiService';
import type { DailySaleRow, SaleDetailLine } from './dailySalesListData';

/** Response from `GET /api/sales/daily-summary` — `getDailySalesSummaryService`. */
export type DailySalesSummaryApi = {
	startDate: string;
	endDate: string;
	totalSales: number;
	transactionCount: number;
	averagePerSale: number;
	daily: Array<{
		date: string;
		totalSales: number;
		transactionCount: number;
		averagePerSale: number;
	}>;
};

export type ListDailySalesArg = {
	startDate?: string;
	endDate?: string;
};

function mapDailyToRow(d: DailySalesSummaryApi['daily'][number]): DailySaleRow {
	const tx = Number(d.transactionCount ?? 0);
	return {
		id: d.date,
		date: d.date,
		sales: tx,
		revenue: Number(d.totalSales ?? 0),
		transactions: tx,
		averageOrder: Number(d.averagePerSale ?? 0)
	};
}

export type SaleByDateApiRow = {
	id: string;
	number_of_items?: number | null;
	total_amount?: number | null;
	invoice_number?: string | null;
	created_at?: string | null;
	customer?: string | null;
};

function normalizeSaleByDateList(raw: unknown): SaleByDateApiRow[] {
	if (Array.isArray(raw)) return raw as SaleByDateApiRow[];
	if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
		return (raw as { data: SaleByDateApiRow[] }).data;
	}
	return [];
}

export function mapSaleRowToDetailLine(row: SaleByDateApiRow): SaleDetailLine {
	const created = row.created_at ? new Date(String(row.created_at)) : new Date();
	const inv = row.invoice_number?.trim();
	return {
		id: inv || String(row.id),
		time: created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
		amount: Number(row.total_amount ?? 0),
		customer: row.customer?.trim() || undefined,
		items: Number(row.number_of_items ?? 0)
	};
}

const DailySalesApi = api.injectEndpoints({
	endpoints: (build) => ({
		getDailySalesSummary: build.query<
			{ summary: DailySalesSummaryApi; rows: DailySaleRow[] },
			ListDailySalesArg | undefined
		>({
			query: (arg) => {
				const params: Record<string, string> = {};
				const a = arg ?? undefined;
				if (a?.startDate) params.startDate = a.startDate;
				if (a?.endDate) params.endDate = a.endDate;
				return { url: '/api/sales/daily-summary', params };
			},
			transformResponse: (raw: unknown) => {
				const r = raw as DailySalesSummaryApi;
				const daily = r.daily || [];
				const rows = [...daily].reverse().map(mapDailyToRow);
				return { summary: r, rows };
			}
		}),
		getSalesByDate: build.query<SaleDetailLine[], { date: string }>({
			query: ({ date }) => ({
				url: '/api/sales/by-date',
				params: { date }
			}),
			transformResponse: (raw: unknown) =>
				normalizeSaleByDateList(raw).map(mapSaleRowToDetailLine)
		})
	}),
	overrideExisting: false
});

export const { useGetDailySalesSummaryQuery, useGetSalesByDateQuery } = DailySalesApi;

export default DailySalesApi;
