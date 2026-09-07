/**
 * Stock count / audit list row — used by the table and `StockCountApi` mapper.
 */

export type StockCountRecord = {
	id: string;
	date: string;
	warehouse: string;
	productCount: number;
	itemsCounted: number;
	/** Aggregate variance not returned by list API — shown as "—" when null. */
	variance: number | null;
	status: 'completed' | 'in_progress' | 'scheduled';
	conductedBy: string;
	referenceNumber?: string;
};
