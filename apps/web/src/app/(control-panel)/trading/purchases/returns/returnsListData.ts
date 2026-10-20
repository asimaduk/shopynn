/**
 * Purchase returns: goods sent back to a supplier.
 */

export type PurchaseReturnItemLine = {
	productName: string;
	sku: string;
	quantity: number;
	unitPrice: number;
	reason?: string;
};

export type PurchaseReturnRecord = {
	id: string;
	reference: string;
	date: string;
	supplier: string;
	originalPurchaseRef: string;
	purchaseId?: string | null;
	store?: string;
	amount: number;
	cashBack: number;
	status: 'approved' | 'pending' | 'rejected';
	reason?: string;
	notes?: string;
	items: PurchaseReturnItemLine[];
};

/** Maps a return from GET /api/returns or /api/returns/:id. */
export function toPurchaseReturnRecord(r: any): PurchaseReturnRecord {
	const status = String(r?.status || '').toLowerCase();
	return {
		id: r.id,
		reference: r.reference_number || r.id,
		date: r.created_at || '',
		supplier: r.supplier_name || '—',
		originalPurchaseRef: r.purchase_invoice_number || '—',
		purchaseId: r.purchase_id || null,
		store: r.warehouse_name || undefined,
		amount: Number(r.total_amount || 0),
		cashBack: Number(r.refund_amount || 0),
		status: status === 'draft' ? 'pending' : status === 'cancelled' ? 'rejected' : 'approved',
		reason: r.reason || undefined,
		notes: r.notes || undefined,
		items: (Array.isArray(r.details) ? r.details : []).map((d: any) => ({
			productName: d.product_name || '—',
			sku: d.sku || '—',
			quantity: Number(d.quantity) || 0,
			unitPrice: Number(d.unit_price) || 0,
			reason: d.reason || r.reason || undefined
		}))
	};
}
