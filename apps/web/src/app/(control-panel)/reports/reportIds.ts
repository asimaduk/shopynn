/** Shared server-safe report id validation (not in a `'use client'` module). */

const VALID_REPORT_IDS = new Set([
	'stock-summary',
	'sales-summary',
	'top-products',
	'sales-by-customer',
	'sales-by-staff',
	'purchase-summary',
	'transfers',
	'adjustments',
	'audit-trail',
	'profit-loss'
]);

export function isValidReportId(id: string): boolean {
	return VALID_REPORT_IDS.has(id);
}
