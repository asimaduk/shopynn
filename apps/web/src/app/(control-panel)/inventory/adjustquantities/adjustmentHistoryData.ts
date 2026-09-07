/**
 * Adjustment history row (list view).
 */

export type AdjustmentRecord = {
	id: string;
	reference: string;
	date: string;
	warehouse: string;
	productsCount: number;
	notes: string;
	createdBy: string;
};
