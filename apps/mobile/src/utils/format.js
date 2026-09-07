export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'GHS',
    }).format(amount).replace('GH₵', 'GHS ').trim();
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