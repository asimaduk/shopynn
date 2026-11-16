import type { TourId } from './tourIds';

export type OverviewStatus = 'pending' | 'completed' | 'skipped';

export type TourPreferences = {
	overviewStatus?: OverviewStatus;
	completed?: Partial<Record<TourId, string>>;
};

export function readTourPreferences(prefs: Record<string, unknown> | null | undefined): TourPreferences {
	const raw = prefs?.tour;
	if (!raw || typeof raw !== 'object') return {};
	const tour = raw as TourPreferences;
	const overviewStatus =
		tour.overviewStatus === 'completed' || tour.overviewStatus === 'skipped' || tour.overviewStatus === 'pending'
			? tour.overviewStatus
			: undefined;
	const completed =
		tour.completed && typeof tour.completed === 'object' ? { ...tour.completed } : undefined;
	return { overviewStatus, completed };
}

export function isOverviewPending(tour: TourPreferences): boolean {
	return !tour.overviewStatus || tour.overviewStatus === 'pending';
}

/** True once the user finished/skipped overview or completed any deep tour. */
export function hasTakenAnyTour(tour: TourPreferences): boolean {
	if (tour.overviewStatus === 'completed' || tour.overviewStatus === 'skipped') return true;
	const completed = tour.completed;
	if (!completed) return false;
	return Object.keys(completed).some((key) => Boolean(completed[key as keyof typeof completed]));
}

export function overviewDonePayload(status: 'completed' | 'skipped') {
	if (status === 'completed') {
		return {
			tour: {
				overviewStatus: status,
				completed: { overview: new Date().toISOString() }
			}
		};
	}
	return { tour: { overviewStatus: status } };
}

export function tourCompletedPayload(tourId: TourId) {
	return {
		tour: {
			...(tourId === 'overview' ? { overviewStatus: 'completed' as const } : {}),
			completed: { [tourId]: new Date().toISOString() }
		}
	};
}
