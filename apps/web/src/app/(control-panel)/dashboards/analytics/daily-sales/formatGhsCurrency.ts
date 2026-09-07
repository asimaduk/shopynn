/** Ghana Cedis, displayed as "GHS " prefix (matches reports). */
export function formatGhsCurrency(
	value: number,
	maximumFractionDigits = 0,
	minimumFractionDigits?: number
): string {
	const n = Number(value);
	if (Number.isNaN(n)) return '—';
	const min = minimumFractionDigits !== undefined ? minimumFractionDigits : 0;
	return new Intl.NumberFormat('en-GH', {
		style: 'currency',
		currency: 'GHS',
		maximumFractionDigits,
		minimumFractionDigits: min
	})
		.format(n)
		.replace('GH₵', 'GHS ');
}
