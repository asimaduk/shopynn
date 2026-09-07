/**
 * Items expiring soon list data (static). Filter by expiry date range.
 */

export type ExpiringListItem = {
	id: string;
	name: string;
	sku: string;
	quantity: number;
	expiryDate: string;
	daysUntilExpiry: number;
	warehouse?: string;
};

// Expiry dates spread over next 45 days for filtering
const today = new Date();
const addDays = (d: number) => {
	const x = new Date(today);
	x.setDate(x.getDate() + d);
	return x.toISOString().split('T')[0];
};

export const EXPIRING_LIST_ITEMS: ExpiringListItem[] = [
	{ id: '1', name: 'Screen Cleaner 100ml', sku: 'SC-100', quantity: 24, expiryDate: addDays(5), daysUntilExpiry: 5, warehouse: 'Main' },
	{ id: '2', name: 'Antibacterial Wipes', sku: 'ABW-50', quantity: 50, expiryDate: addDays(8), daysUntilExpiry: 8, warehouse: 'Store A' },
	{ id: '3', name: 'Printer Ink Cyan', sku: 'INK-C', quantity: 12, expiryDate: addDays(13), daysUntilExpiry: 13, warehouse: 'Main' },
	{ id: '4', name: 'Battery Pack AA', sku: 'BAT-AA-8', quantity: 40, expiryDate: addDays(26), daysUntilExpiry: 26, warehouse: 'Store B' },
	{ id: '5', name: 'Printer Ink Magenta', sku: 'INK-M', quantity: 8, expiryDate: addDays(3), daysUntilExpiry: 3, warehouse: 'Main' },
	{ id: '6', name: 'Hand Sanitizer 500ml', sku: 'HS-500', quantity: 60, expiryDate: addDays(12), daysUntilExpiry: 12, warehouse: 'Store A' },
	{ id: '7', name: 'Disinfectant Spray', sku: 'DS-250', quantity: 30, expiryDate: addDays(1), daysUntilExpiry: 1, warehouse: 'Main' },
	{ id: '8', name: 'Gloves Box M', sku: 'GLV-M', quantity: 100, expiryDate: addDays(20), daysUntilExpiry: 20, warehouse: 'Store B' },
	{ id: '9', name: 'Face Masks 50pk', sku: 'FM-50', quantity: 45, expiryDate: addDays(6), daysUntilExpiry: 6, warehouse: 'Main' },
	{ id: '10', name: 'Toner Cartridge', sku: 'TC-BK', quantity: 5, expiryDate: addDays(15), daysUntilExpiry: 15, warehouse: 'Store A' },
	{ id: '11', name: 'Lens Wipes 100', sku: 'LW-100', quantity: 20, expiryDate: addDays(4), daysUntilExpiry: 4, warehouse: 'Main' },
	{ id: '12', name: 'Air Duster', sku: 'AD-400', quantity: 18, expiryDate: addDays(30), daysUntilExpiry: 30, warehouse: 'Store B' },
	{ id: '13', name: 'Cleaning Solution 1L', sku: 'CS-1L', quantity: 12, expiryDate: addDays(2), daysUntilExpiry: 2, warehouse: 'Main' },
	{ id: '14', name: 'Paper Towels 6pk', sku: 'PT-6', quantity: 35, expiryDate: addDays(22), daysUntilExpiry: 22, warehouse: 'Store A' },
	{ id: '15', name: 'Staples Box', sku: 'ST-5K', quantity: 8, expiryDate: addDays(40), daysUntilExpiry: 40, warehouse: 'Main' }
];

export function filterExpiringListByDateRange(
	items: ExpiringListItem[],
	startDate: string | null,
	endDate: string | null
): ExpiringListItem[] {
	if (!startDate && !endDate) return items;
	return items.filter((item) => {
		const d = item.expiryDate;
		if (startDate && d < startDate) return false;
		if (endDate && d > endDate) return false;
		return true;
	});
}
