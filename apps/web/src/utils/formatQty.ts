const qtyFormatter = new Intl.NumberFormat('en-GH', { maximumFractionDigits: 3 });

/** Quantities are stored with 3 decimals; show 66 instead of 66.000 and keep real fractions. */
export function formatQty(value: number | string | null | undefined): string {
	if (value == null || value === '') return '—';
	const n = Number(value);
	if (Number.isNaN(n)) return String(value);
	return qtyFormatter.format(n);
}
