/**
 * Items to reorder list data (static). Add reportedAt for date filtering.
 */

export type ReorderListItem = {
	id: string;
	name: string;
	sku: string;
	currentStock: number;
	reorderLevel: number;
	warehouse: string;
	reportedAt: string; // ISO date string for filtering
};

// Generate data with varied dates over the last 60 days for filtering demo
const now = new Date();
const day = (d: number) => {
	const x = new Date(now);
	x.setDate(x.getDate() - d);
	return x.toISOString().split('T')[0];
};

export const REORDER_LIST_ITEMS: ReorderListItem[] = [
	{ id: '1', name: 'USB-C Cable 2m', sku: 'USB-2M', currentStock: 12, reorderLevel: 50, warehouse: 'Main', reportedAt: day(2) },
	{ id: '2', name: 'Wireless Mouse', sku: 'WM-001', currentStock: 8, reorderLevel: 30, warehouse: 'Main', reportedAt: day(1) },
	{ id: '3', name: 'Screen Cleaner 100ml', sku: 'SC-100', currentStock: 3, reorderLevel: 20, warehouse: 'Store A', reportedAt: day(0) },
	{ id: '4', name: 'Laptop Stand', sku: 'LS-01', currentStock: 5, reorderLevel: 15, warehouse: 'Main', reportedAt: day(3) },
	{ id: '5', name: 'HDMI Cable', sku: 'HDMI-1', currentStock: 0, reorderLevel: 25, warehouse: 'Store B', reportedAt: day(0) },
	{ id: '6', name: 'Keyboard Wired', sku: 'KB-W01', currentStock: 7, reorderLevel: 20, warehouse: 'Main', reportedAt: day(5) },
	{ id: '7', name: 'Webcam HD', sku: 'WC-HD', currentStock: 4, reorderLevel: 10, warehouse: 'Store A', reportedAt: day(8) },
	{ id: '8', name: 'Mouse Pad', sku: 'MP-L', currentStock: 0, reorderLevel: 30, warehouse: 'Main', reportedAt: day(1) },
	{ id: '9', name: 'USB Hub 4-Port', sku: 'UH-4', currentStock: 6, reorderLevel: 15, warehouse: 'Store B', reportedAt: day(12) },
	{ id: '10', name: 'Laptop Bag', sku: 'LB-15', currentStock: 9, reorderLevel: 25, warehouse: 'Main', reportedAt: day(7) },
	{ id: '11', name: 'Power Adapter 65W', sku: 'PA-65', currentStock: 2, reorderLevel: 12, warehouse: 'Store A', reportedAt: day(4) },
	{ id: '12', name: 'Ethernet Cable 5m', sku: 'ETH-5', currentStock: 11, reorderLevel: 40, warehouse: 'Main', reportedAt: day(15) },
	{ id: '13', name: 'Headset Stand', sku: 'HS-ST', currentStock: 0, reorderLevel: 8, warehouse: 'Store B', reportedAt: day(2) },
	{ id: '14', name: 'Monitor Arm', sku: 'MA-1', currentStock: 5, reorderLevel: 10, warehouse: 'Main', reportedAt: day(20) },
	{ id: '15', name: 'Desk Mat', sku: 'DM-XL', currentStock: 14, reorderLevel: 20, warehouse: 'Store A', reportedAt: day(6) },
	{ id: '16', name: 'Phone Holder', sku: 'PH-D', currentStock: 3, reorderLevel: 15, warehouse: 'Main', reportedAt: day(9) },
	{ id: '17', name: 'Cable Clips Pack', sku: 'CC-10', currentStock: 8, reorderLevel: 25, warehouse: 'Store B', reportedAt: day(11) },
	{ id: '18', name: 'Screen Wipes', sku: 'SW-50', currentStock: 4, reorderLevel: 20, warehouse: 'Main', reportedAt: day(14) }
];

export function filterReorderListByDateRange(
	items: ReorderListItem[],
	startDate: string | null,
	endDate: string | null
): ReorderListItem[] {
	if (!startDate && !endDate) return items;
	return items.filter((item) => {
		const d = item.reportedAt;
		if (startDate && d < startDate) return false;
		if (endDate && d > endDate) return false;
		return true;
	});
}
