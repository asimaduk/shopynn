/**
 * Purchase returns list data (static).
 */

export type PurchaseReturnItemLine = {
	productName: string;
	sku: string;
	quantity: number;
	unitPrice: number;
	reason?: string;
};

export type PurchaseReturnRecord = {
	id: string;
	reference: string;
	date: string;
	supplier: string;
	originalPurchaseRef: string;
	amount: number;
	status: 'approved' | 'pending' | 'rejected';
	items: PurchaseReturnItemLine[];
};

const now = new Date();
const day = (d: number) => {
	const x = new Date(now);
	x.setDate(x.getDate() - d);
	return x.toISOString().split('T')[0];
};

export const PURCHASE_RETURNS: PurchaseReturnRecord[] = [
	{
		id: 'pr1',
		reference: 'PR-2026-001',
		date: day(1),
		supplier: 'Tech Supplies Inc',
		originalPurchaseRef: 'PO-1882',
		amount: 540,
		status: 'approved',
		items: [
			{ productName: 'Webcam HD', sku: 'WC-HD', quantity: 4, unitPrice: 85, reason: 'Damaged in transit' },
			{ productName: 'USB Hub 4-Port', sku: 'UH-4', quantity: 2, unitPrice: 100, reason: 'Wrong model' }
		]
	},
	{
		id: 'pr2',
		reference: 'PR-2026-002',
		date: day(4),
		supplier: 'Office Depot',
		originalPurchaseRef: 'PO-1879',
		amount: 225,
		status: 'pending',
		items: [{ productName: 'Desk Mat', sku: 'DM-XL', quantity: 5, unitPrice: 45 }]
	},
	{
		id: 'pr3',
		reference: 'PR-2026-003',
		date: day(7),
		supplier: 'Tech Supplies Inc',
		originalPurchaseRef: 'PO-1875',
		amount: 120,
		status: 'rejected',
		items: [{ productName: 'Mouse Pad', sku: 'MP-L', quantity: 10, unitPrice: 12 }]
	}
];

export function filterPurchaseReturnsByDateRange(
	items: PurchaseReturnRecord[],
	startDate: string | null,
	endDate: string | null
): PurchaseReturnRecord[] {
	if (!startDate && !endDate) return items;
	return items.filter((row) => {
		const d = row.date;
		if (startDate && d < startDate) return false;
		if (endDate && d > endDate) return false;
		return true;
	});
}

export function getPurchaseReturnById(id: string): PurchaseReturnRecord | undefined {
	return PURCHASE_RETURNS.find((r) => r.id === id);
}
