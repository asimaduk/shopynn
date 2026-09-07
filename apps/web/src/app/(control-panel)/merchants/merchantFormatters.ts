import type { AdminMerchantRow } from './MerchantApi';

export function formatMoney(v: string | number | null | undefined) {
	const n = Number(v);
	if (!Number.isFinite(n)) return '—';
	return n.toFixed(2);
}

export function formatDate(iso: string | null | undefined) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export function formatDateShort(iso: string | null | undefined) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	} catch {
		return iso;
	}
}

export function userDisplayName(m: Pick<AdminMerchantRow, 'first_name' | 'last_name' | 'email' | 'phone' | 'user_id'>) {
	const n = [m.first_name, m.last_name].filter(Boolean).join(' ').trim();
	return n || m.email || m.phone || m.user_id;
}
