/**
 * Stock count / audit list row — used by the table and `StockCountApi` mapper.
 */

export type StockCountRecord = {
	id: string;
	date: string;
	warehouse: string;
	productCount: number;
	itemsCounted: number;
	/** Net variance across all counted lines; "—" when unavailable. */
	variance: number | null;
	status: 'completed' | 'in_progress' | 'scheduled';
	conductedBy: string;
	referenceNumber?: string;
};
