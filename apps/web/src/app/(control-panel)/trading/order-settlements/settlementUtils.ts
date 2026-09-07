/** Shape returned by the payout-profile API (loose strings). */
export type PayoutProfileInput = {
	payout_method?: string;
	momo_network?: string;
	momo_number?: string;
	bank_name?: string;
	bank_account_number?: string;
	bank_account_name?: string;
	account_holder_name?: string;
	paystack_bank_code?: string;
	updated_at?: string;
};

export type PayoutProfile = PayoutProfileInput & {
	payout_method?: 'momo' | 'bank';
};

export type SettlementRow = {
	id?: string;
	amount?: number;
	status?: string;
	source?: string;
	note?: string;
	payout_reference?: string;
	rejection_reason?: string;
	payout_snapshot?: PayoutProfileInput | null;
	created_at?: string;
	paid_at?: string;
};

export function formatPayoutSnapshot(snapshot?: PayoutProfileInput | null) {
	if (!snapshot) return '—';
	const method = String(snapshot.payout_method || '').toLowerCase();
	if (method === 'momo') {
		return `${String(snapshot.momo_network || '').toUpperCase()} MoMo · ${snapshot.momo_number || '—'}`;
	}
	if (method === 'bank') {
		return `${snapshot.bank_name || 'Bank'} · ${snapshot.bank_account_number || '—'}`;
	}
	return '—';
}

export function settlementStatusLabel(status?: string) {
	const s = String(status || '').toLowerCase();
	if (s === 'paid') return 'Paid';
	if (s === 'processing') return 'Processing';
	if (s === 'pending') return 'Processing';
	if (s === 'requested') return 'Requested';
	if (s === 'failed') return 'Failed';
	if (s === 'rejected') return 'Rejected';
	return status || '—';
}

export function settlementStatusColor(status?: string): 'success' | 'warning' | 'error' | 'default' {
	const s = String(status || '').toLowerCase();
	if (s === 'paid') return 'success';
	if (s === 'pending' || s === 'processing') return 'warning';
	if (s === 'requested') return 'default';
	if (s === 'failed' || s === 'rejected') return 'error';
	return 'default';
}
