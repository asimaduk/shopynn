/**
 * Sales returns list data (static).
 */

export type SaleReturnItemLine = {
	productName: string;
	sku: string;
	quantity: number;
	unitPrice: number;
	reason?: string;
};

export type SaleReturnRecord = {
	id: string;
	reference: string;
	date: string;
	customer: string;
	originalSaleRef: string;
	amount: number;
	status: 'approved' | 'pending' | 'rejected';
	items: SaleReturnItemLine[];
};

const now = new Date();
const day = (d: number) => {
	const x = new Date(now);
	x.setDate(x.getDate() - d);
	return x.toISOString().split('T')[0];
};

export const SALES_RETURNS: SaleReturnRecord[] = [
	{
		id: 'sr1',
		reference: 'SR-2026-001',
		date: day(0),
		customer: 'Acme Ltd',
		originalSaleRef: 'INV-2044',
		amount: 320,
		status: 'approved',
		items: [
			{ productName: 'Wireless Mouse', sku: 'WM-001', quantity: 2, unitPrice: 45, reason: 'Defective' },
			{ productName: 'USB-C Cable 2m', sku: 'USB-2M', quantity: 5, unitPrice: 12, reason: 'Wrong item' }
		]
	},
	{
		id: 'sr2',
		reference: 'SR-2026-002',
		date: day(2),
		customer: 'Walk-in',
		originalSaleRef: 'INV-2041',
		amount: 89,
		status: 'pending',
		items: [{ productName: 'Screen Cleaner 100ml', sku: 'SC-100', quantity: 1, unitPrice: 89 }]
	},
	{
		id: 'sr3',
		reference: 'SR-2026-003',
		date: day(5),
		customer: 'Tech Store Co',
		originalSaleRef: 'INV-2038',
		amount: 450,
		status: 'approved',
		items: [
			{ productName: 'Laptop Stand', sku: 'LS-01', quantity: 3, unitPrice: 150 }
		]
	},
	{
		id: 'sr4',
		reference: 'SR-2026-004',
		date: day(8),
		customer: 'Office Supplies',
		originalSaleRef: 'INV-2032',
		amount: 156,
		status: 'rejected',
		items: [{ productName: 'Mouse Pad', sku: 'MP-L', quantity: 4, unitPrice: 39 }]
	}
];

export function filterSalesReturnsByDateRange(
	items: SaleReturnRecord[],
	startDate: string | null,
	endDate: string | null
): SaleReturnRecord[] {
	if (!startDate && !endDate) return items;
	return items.filter((row) => {
		const d = row.date;
		if (startDate && d < startDate) return false;
		if (endDate && d > endDate) return false;
		return true;
	});
}

export function getSalesReturnById(id: string): SaleReturnRecord | undefined {
	return SALES_RETURNS.find((r) => r.id === id);
}
