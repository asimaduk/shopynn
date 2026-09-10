export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'GHS',
    }).format(amount).replace('GH₵', 'GHS ').trim();
};

/** Drop trailing zeros from decimal quantities (e.g. 100.000 → 100). */
export const formatQuantity = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? 0);
    return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
};

export const formatDateAndTime = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

export const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        return 'Not Available';
    }
    if (startDate === endDate) {
        return formatDate(startDate);
    }
    return new Date(startDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }) + ' - ' + new Date(endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatAction = (action) => {
    if (!action || typeof action !== 'string') return 'Not Available';
    // Replace underscores with spaces, lowercase the string, and capitalize each word
    return action
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}