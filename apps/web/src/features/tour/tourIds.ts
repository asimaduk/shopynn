export const TOUR_IDS = ['overview', 'inventory', 'sales', 'purchases', 'reports', 'settings'] as const;

export type TourId = (typeof TOUR_IDS)[number];

export function isTourId(value: string): value is TourId {
	return (TOUR_IDS as readonly string[]).includes(value);
}
