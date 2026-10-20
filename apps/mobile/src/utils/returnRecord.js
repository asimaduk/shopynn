/** Shape an API return (list row or detail) for the returns screens. */
export function toReturnRecord(r = {}) {
    const createdAt = r.created_at ? new Date(r.created_at) : null;
    const statusRaw = String(r.status || '').toLowerCase();
    const status =
        statusRaw === 'draft'
            ? 'Pending'
            : statusRaw === 'cancelled'
              ? 'Rejected'
              : 'Approved';
    const type = r.purchase_id || r.type === 'purchase' ? 'purchase' : 'sales';
    const amount = Number(r.total_amount ?? r.refund_amount ?? 0);
    const details = Array.isArray(r.details) ? r.details : null;
    const itemsFromDetails = details ? details.reduce((n, d) => n + (Number(d.quantity) || 0), 0) : null;
    return {
        id: r.id,
        type,
        reference: r.reference_number || '',
        ref:
            type === 'purchase'
                ? r.purchase_invoice_number || r.reference_number || ''
                : r.sale_invoice_number || r.order_number || r.reference_number || '',
        customer: r.customer_name || 'Walk-in',
        supplier: r.supplier_name || '—',
        warehouse: r.warehouse_name || '',
        createdAt,
        date: createdAt
            ? createdAt.toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
              })
            : '',
        items: itemsFromDetails ?? Number(r.items_count ?? r.items ?? 0),
        amount: amount.toFixed(2),
        refundMethod: r.refund_method || '',
        refundAmount: Number(r.refund_amount ?? 0),
        reason: r.reason || r.notes || '',
        notes: r.notes || '',
        status,
        purchaseId: r.purchase_id || null,
        saleId: r.sale_id || null,
        details,
    };
}
