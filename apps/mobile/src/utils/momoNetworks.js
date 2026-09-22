/** MoMo network logos (from easyown) + Paystack provider codes. */
export const MOMO_NETWORK_ICONS = {
    mtn: require('../assets/networks/mtnmomo.png'),
    telecel: require('../assets/networks/telecelcash.png'),
    vodafone: require('../assets/networks/telecelcash.png'),
    airteltigo: require('../assets/networks/atmoney.png'),
};

export const MOMO_NETWORK_OPTIONS = [
    { id: 'mtn', label: 'MTN', provider: 'mtn', color: '#FFCC00', prefixes: ['024', '054', '055', '059'] },
    { id: 'telecel', label: 'Telecel', provider: 'vod', color: '#E60000', prefixes: ['020', '050'] },
    { id: 'airteltigo', label: 'AirtelTigo', provider: 'tgo', color: '#1F3A93', prefixes: ['026', '027', '056', '057'] },
];

export const getMomoNetworkIcon = (idOrProvider = '') => {
    const key = String(idOrProvider || '').toLowerCase();
    if (key === 'vod' || key === 'vodafone' || key === 'telecel') return MOMO_NETWORK_ICONS.telecel;
    if (key === 'tgo' || key === 'airteltigo' || key === 'at') return MOMO_NETWORK_ICONS.airteltigo;
    return MOMO_NETWORK_ICONS.mtn;
};

/** Telecel / Vodafone — Paystack requires *110# voucher (submit_otp). */
export const isTelecelMomoProvider = (provider = '') => {
    const key = String(provider || '').toLowerCase();
    return key === 'vod' || key === 'vodafone' || key === 'telecel';
};

/** Normalize to local Ghana MSISDN 0XXXXXXXXX. */
export const normalizeGhanaMomoNumber = (raw) => {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('233') && digits.length >= 12) digits = `0${digits.slice(3)}`;
    else if (digits.length === 9) digits = `0${digits}`;
    return digits.slice(0, 10);
};

/**
 * Validate number against selected Paystack provider.
 * @returns {{ ok: boolean, message?: string, digits: string }}
 */
export const validateMomoNumberForProvider = (raw, provider) => {
    const digits = normalizeGhanaMomoNumber(raw);
    if (!/^0\d{9}$/.test(digits)) {
        return { ok: false, digits, message: 'Enter a full 10-digit MoMo number.' };
    }
    // Prefix ↔ network check paused — MTN (and others) have overlapping / new prefixes (e.g. 025).
    // const network = MOMO_NETWORK_OPTIONS.find((n) => n.provider === provider) || MOMO_NETWORK_OPTIONS[0];
    // const prefix = digits.slice(0, 3);
    // if (network?.prefixes?.length && !network.prefixes.includes(prefix)) {
    //     return {
    //         ok: false,
    //         digits,
    //         message: `${network.label} numbers start with ${network.prefixes.join(', ')}. Check the number or network.`,
    //     };
    // }
    return { ok: true, digits };
};
