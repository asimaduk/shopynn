/**
 * Daily sales row types and aggregates (data from `DailySalesApi` + `GET /api/sales/*`).
 */

export type DailySaleRow = {
	id: string;
	date: string; // ISO date YYYY-MM-DD
	/** Number of sale transactions (same as transactions). */
	sales: number;
	revenue: number;
	transactions: number;
	averageOrder: number;
};

/** Single sale line for a day detail table */
export type SaleDetailLine = {
	id: string;
	time: string;
	amount: number;
	customer?: string;
	items: number;
};

/** Aggregates for the totals widget (filtered rows). */
export function aggregateDailySales(rows: DailySaleRow[]) {
	const totalSales = rows.reduce((s, r) => s + r.sales, 0);
	const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
	const totalTransactions = rows.reduce((s, r) => s + r.transactions, 0);
	const averageOrder =
		totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
	return { totalSales, totalRevenue, totalTransactions, averageOrder };
}
