/** MoMo network logos (from easyown) + Paystack provider codes. */
export const MOMO_NETWORK_ICONS = {
    mtn: require('../assets/networks/mtnmomo.png'),
    telecel: require('../assets/networks/telecelcash.png'),
    vodafone: require('../assets/networks/telecelcash.png'),
    airteltigo: require('../assets/networks/atmoney.png'),
};

export const MOMO_NETWORK_OPTIONS = [
    { id: 'mtn', label: 'MTN', provider: 'mtn', color: '#FFCC00' },
    { id: 'telecel', label: 'Telecel', provider: 'vod', color: '#E60000' },
    { id: 'airteltigo', label: 'AirtelTigo', provider: 'tgo', color: '#1F3A93' },
];

export const getMomoNetworkIcon = (idOrProvider = '') => {
    const key = String(idOrProvider || '').toLowerCase();
    if (key === 'vod' || key === 'vodafone' || key === 'telecel') return MOMO_NETWORK_ICONS.telecel;
    if (key === 'tgo' || key === 'airteltigo' || key === 'at') return MOMO_NETWORK_ICONS.airteltigo;
    return MOMO_NETWORK_ICONS.mtn;
};
