/** Parity with `cheqstock/src/containers/home/product_transactions.js` — `getDateRangeBounds`. */

export type DateRangePreset =
	| 'today'
	| 'yesterday'
	| 'last_7_days'
	| 'last_30_days'
	| 'this_month'
	| 'last_month'
	| 'custom';

export const DATE_RANGE_PRESETS: { id: string; label: string; value: DateRangePreset }[] = [
	{ id: '1', label: 'Today', value: 'today' },
	{ id: '2', label: 'Yesterday', value: 'yesterday' },
	{ id: '3', label: 'Last 7 Days', value: 'last_7_days' },
	{ id: '4', label: 'Last 30 Days', value: 'last_30_days' },
	{ id: '5', label: 'This Month', value: 'this_month' },
	{ id: '6', label: 'Last Month', value: 'last_month' },
	{ id: '8', label: 'Custom Range', value: 'custom' }
];

export function getDateRangeBounds(
	selectedRange: DateRangePreset,
	customStart: Date,
	customEnd: Date
): { startDate: Date; endDate: Date } {
	const end = new Date();
	const start = new Date();
	if (selectedRange === 'custom') {
		return { startDate: customStart, endDate: customEnd };
	}
	switch (selectedRange) {
		case 'today':
			start.setHours(0, 0, 0, 0);
			end.setHours(23, 59, 59, 999);
			break;
		case 'yesterday':
			start.setDate(start.getDate() - 1);
			start.setHours(0, 0, 0, 0);
			end.setDate(end.getDate() - 1);
			end.setHours(23, 59, 59, 999);
			break;
		case 'last_7_days':
			start.setDate(start.getDate() - 6);
			start.setHours(0, 0, 0, 0);
			break;
		case 'last_30_days':
			start.setDate(start.getDate() - 29);
			start.setHours(0, 0, 0, 0);
			break;
		case 'this_month':
			start.setDate(1);
			start.setHours(0, 0, 0, 0);
			break;
		case 'last_month':
			start.setMonth(start.getMonth() - 1);
			start.setDate(1);
			start.setHours(0, 0, 0, 0);
			end.setDate(0);
			end.setHours(23, 59, 59, 999);
			break;
		default:
			start.setDate(start.getDate() - 6);
			start.setHours(0, 0, 0, 0);
	}
	return { startDate: start, endDate: end };
}

export function formatDateYmd(d: Date): string {
	return d.toISOString().split('T')[0];
}

export function getDateRangeLabel(
	preset: DateRangePreset,
	customStart: Date,
	customEnd: Date
): string {
	if (preset === 'custom') {
		return `${customStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${customEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	}
	return DATE_RANGE_PRESETS.find((r) => r.value === preset)?.label ?? 'Last 7 Days';
}
