import type { BillingCatalogItem } from '../billing/BillingCatalogApi';

export function formatCatalogItemType(type: BillingCatalogItem['item_type'] | string): string {
	switch (type) {
		case 'subscription_monthly':
			return 'Monthly subscription';
		case 'onboarding':
			return 'Assisted go-live';
		case 'addon':
			return 'Add-on';
		default:
			return String(type || '—');
	}
}

export function formatCatalogCommission(value: string | null | undefined): string {
	const v = String(value || '').toLowerCase();
	if (v.includes('onboarding')) return 'Onboarding 15%';
	if (v.includes('residual') || v.includes('first_month')) return 'Residual 5%';
	if (v === 'none') return 'None';
	return value || '—';
}

export function formatCatalogAmount(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(Number(value))) return '—';
	return Number(value).toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	});
}
