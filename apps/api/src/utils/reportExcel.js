/**
 * Branded Excel (.xlsx) for mobile/web report exports (SheetJS).
 * Workbook: Summary sheet (meta + cards) + Details sheet (table).
 */

function safeCell(value) {
	if (value == null || value === '') return '';
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}
	return String(value).trim();
}

function humanizeKey(key) {
	return String(key || '')
		.replace(/_/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function detailColumns(rows) {
	if (!rows.length) return [];
	return Object.keys(rows[0]).filter((k) => k !== '_raw' && k !== 'id');
}

function autoColWidths(aoa, min = 10, max = 42) {
	const widths = [];
	for (const row of aoa) {
		row.forEach((cell, i) => {
			const len = String(cell ?? '').length + 2;
			widths[i] = Math.min(max, Math.max(widths[i] || min, len, min));
		});
	}
	return widths.map((w) => ({ wch: w }));
}

/**
 * @param {{
 *   title?: string,
 *   companyName?: string,
 *   dateRangeLabel?: string,
 *   cards?: Array<{ label?: string, value?: unknown }>,
 *   rows?: Array<Record<string, unknown>>,
 * }} payload
 * @returns {Promise<Buffer>}
 */
export async function buildReportExcelBuffer(payload = {}) {
	const XLSX = (await import('xlsx')).default;
	const title = String(payload.title || 'Report').trim() || 'Report';
	const companyName = String(payload.companyName || 'Shopynn').trim() || 'Shopynn';
	const dateRangeLabel = String(payload.dateRangeLabel || 'All time').trim() || 'All time';
	const cards = Array.isArray(payload.cards) ? payload.cards.slice(0, 12) : [];
	const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 5000) : [];
	const exportedAt = new Date().toLocaleString('en-GB', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	const columns = detailColumns(rows);
	const headers = columns.map(humanizeKey);

	const summaryAoa = [
		['Shopynn Report'],
		['Company', companyName],
		['Report', title],
		['Period', dateRangeLabel],
		['Exported', exportedAt],
		['Records', rows.length],
		[],
		['Summary'],
		['Metric', 'Value'],
		...cards.map((c) => [safeCell(c.label || 'Metric'), safeCell(c.value)]),
	];
	if (!cards.length) {
		summaryAoa.push(['No summary metrics', '']);
	}

	const detailsAoa = [headers];
	for (const row of rows) {
		detailsAoa.push(columns.map((key) => safeCell(row?.[key])));
	}
	if (!rows.length) {
		detailsAoa.push(columns.length ? columns.map(() => '') : ['No detail rows for this period.']);
	}

	const wb = XLSX.utils.book_new();

	const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
	summarySheet['!cols'] = autoColWidths(summaryAoa);
	// Merge title row across two columns
	summarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
	XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

	const detailsSheet = XLSX.utils.aoa_to_sheet(
		detailsAoa.length > 1 || headers.length ? detailsAoa : [['No detail rows for this period.']]
	);
	detailsSheet['!cols'] = autoColWidths(detailsAoa);
	XLSX.utils.book_append_sheet(wb, detailsSheet, 'Details');

	const out = XLSX.write(wb, {
		type: 'buffer',
		bookType: 'xlsx',
		compression: true,
	});
	return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
