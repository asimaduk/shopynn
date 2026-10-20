export type DatePresetId =
	| 'all_time'
	| 'today'
	| 'yesterday'
	| 'last_7_days'
	| 'last_30_days'
	| 'this_month'
	| 'last_month'
	| 'custom';

export const DATE_PRESET_OPTIONS: { id: DatePresetId; label: string }[] = [
	{ id: 'all_time', label: 'All time' },
	{ id: 'today', label: 'Today' },
	{ id: 'yesterday', label: 'Yesterday' },
	{ id: 'last_7_days', label: 'Last 7 days' },
	{ id: 'last_30_days', label: 'Last 30 days' },
	{ id: 'this_month', label: 'This month' },
	{ id: 'last_month', label: 'Last month' },
	{ id: 'custom', label: 'Custom range' }
];

/** Matches mobile `getDateParams` in report_detail.js: endDate is exclusive (the day after the range). */
export function getApiDateRange(
	preset: DatePresetId,
	customStart?: Date,
	customEnd?: Date
): { startDate: string; endDate: string } | undefined {
	if (preset === 'all_time') return undefined;

	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let start = today;
	let end = new Date(today.getTime() + 24 * 60 * 60 * 1000);

	if (preset === 'today') {
		start = today;
		end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
	} else if (preset === 'custom' && customStart && customEnd) {
		start = customStart;
		end = new Date(customEnd.getTime() + 24 * 60 * 60 * 1000);
	} else if (preset === 'yesterday') {
		start = new Date(today);
		start.setDate(start.getDate() - 1);
		end = today;
	} else if (preset === 'last_7_days') {
		start = new Date(today);
		start.setDate(start.getDate() - 7);
	} else if (preset === 'last_30_days') {
		start = new Date(today);
		start.setDate(start.getDate() - 30);
	} else if (preset === 'this_month') {
		start = new Date(now.getFullYear(), now.getMonth(), 1);
	} else if (preset === 'last_month') {
		start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		end = new Date(now.getFullYear(), now.getMonth(), 1);
	}

	return {
		startDate: toLocalYmd(start),
		endDate: toLocalYmd(end)
	};
}

function toLocalYmd(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
