export const TOUR_IDS = [
    'overview',
    'inventory',
    'sales',
    'purchases',
    'customers',
    'staff',
    'reports',
    'settings',
];

export function isTourId(value) {
    return TOUR_IDS.includes(value);
}
