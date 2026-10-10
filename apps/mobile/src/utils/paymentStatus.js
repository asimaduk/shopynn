export function getPaymentStatusBadgeStyle(status) {
    const s = String(status || '').toLowerCase();
    if (['completed', 'success', 'paid'].includes(s)) {
        return { backgroundColor: '#dcfce7', color: '#10b981' };
    }
    if (['failed', 'error', 'cancelled', 'canceled'].includes(s)) {
        return { backgroundColor: '#fee2e2', color: '#ef4444' };
    }
    if (['pending', 'processing'].includes(s)) {
        return { backgroundColor: '#fef3c7', color: '#f59e0b' };
    }
    return { backgroundColor: '#f3f4f6', color: '#6b7280' };
}
