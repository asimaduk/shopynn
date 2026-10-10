export const formatCurrency = (amount) => {
    const n = Number(amount) || 0;
    const formatted = n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `GH₵ ${formatted}`;
};

/** Drop trailing zeros from decimal quantities (e.g. 100.000 → 100). */
export const formatQuantity = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? 0);
    // Always trim via toFixed so Postgres numeric strings like "40.000" become "40".
    return String(parseFloat(n.toFixed(3)));
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

const UNIT_ABBREVIATIONS = new Set(['kg', 'g', 'ltr', 'l', 'ml', 'cm', 'mm', 'm']);

/** Measurement units read naturally after a quantity: 1 unit, 2 units, 1 box, 3 boxes, 2 kg. */
export const formatUnit = (qty, unit) => {
    const raw = String(unit || 'unit').trim();
    const lower = raw.toLowerCase();
    if (UNIT_ABBREVIATIONS.has(lower)) return raw;
    const singular = lower.endsWith('es') && /(box|ch|sh|ss)es$/.test(lower)
        ? raw.slice(0, -2)
        : lower.endsWith('s') && !lower.endsWith('ss')
            ? raw.slice(0, -1)
            : raw;
    if (Number(qty) === 1) return singular;
    return /(x|ch|sh|ss)$/i.test(singular) ? `${singular}es` : `${singular}s`;
};

export const formatQtyWithUnit = (qty, unit) => `${formatQuantity(qty)} ${formatUnit(qty, unit)}`;

const GH_MOMO_PREFIXES = {
    mtn: ['24', '25', '53', '54', '55', '59'],
    telecel: ['20', '50'],
    airteltigo: ['26', '27', '56', '57'],
};

/** Ghana mobile money network from the number prefix (0551234987 / 233551234987 → 'mtn'), or '' if unknown. */
export const inferGhanaMomoNetwork = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    const local = digits.startsWith('233') ? digits.slice(3) : digits.replace(/^0/, '');
    if (local.length !== 9) return '';
    const prefix = local.slice(0, 2);
    return Object.keys(GH_MOMO_PREFIXES).find((net) => GH_MOMO_PREFIXES[net].includes(prefix)) || '';
};

/** Phone-OTP signups get a synthetic `<phone>@otp.shopynn.local` email that should never be shown. */
export const isPlaceholderEmail = (email) =>
    String(email || '').trim().toLowerCase().endsWith('@otp.shopynn.local');

export const displayEmail = (email) => (isPlaceholderEmail(email) ? '' : String(email || '').trim());

/** 233209990123 → +233 20 999 0123; other values are returned unchanged. */
export const formatPhone = (phone) => {
    const raw = String(phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('233')) {
        return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    }
    if (digits.length === 10 && digits.startsWith('0')) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return raw;
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