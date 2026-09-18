/** sessionStorage key for restoring a parked POS MoMo cart on New Sale. */
export const RESUME_PARKED_MOMO_KEY = 'shopynn.resume_parked_momo';

export type ResumeParkedMomoPayload = {
	transaction_ref: string;
	payment_number?: string | null;
	status?: string | null;
	face_amount?: number | null;
	fee_amount?: number | null;
	amount?: number | null;
	pos_cart_snapshot?: {
		warehouse_id?: string | null;
		warehouse_name?: string | null;
		customer_id?: string | null;
		customer_name?: string | null;
		products?: Array<Record<string, unknown>>;
		currentOrder?: Array<Record<string, unknown>>;
		bulk_discount?: unknown;
		provider?: string | null;
	} | null;
};

export function writeResumeParkedMomo(payload: ResumeParkedMomoPayload) {
	if (typeof window === 'undefined') return;
	sessionStorage.setItem(RESUME_PARKED_MOMO_KEY, JSON.stringify(payload));
}

export function consumeResumeParkedMomo(): ResumeParkedMomoPayload | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(RESUME_PARKED_MOMO_KEY);
		if (!raw) return null;
		sessionStorage.removeItem(RESUME_PARKED_MOMO_KEY);
		return JSON.parse(raw) as ResumeParkedMomoPayload;
	} catch {
		sessionStorage.removeItem(RESUME_PARKED_MOMO_KEY);
		return null;
	}
}
