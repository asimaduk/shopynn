export function readTourPreferences(prefs) {
    const raw = prefs?.tour;
    if (!raw || typeof raw !== 'object') return {};
    const overviewStatus =
        raw.overviewStatus === 'completed' ||
        raw.overviewStatus === 'skipped' ||
        raw.overviewStatus === 'pending'
            ? raw.overviewStatus
            : undefined;
    const completed =
        raw.completed && typeof raw.completed === 'object' ? { ...raw.completed } : undefined;
    return { overviewStatus, completed };
}

export function isOverviewPending(tour) {
    return !tour.overviewStatus || tour.overviewStatus === 'pending';
}

/** True once the user finished/skipped overview or completed any deep tour. */
export function hasTakenAnyTour(tour) {
    if (tour.overviewStatus === 'completed' || tour.overviewStatus === 'skipped') return true;
    const completed = tour.completed;
    if (!completed) return false;
    return Object.keys(completed).some((key) => Boolean(completed[key]));
}

export function overviewDonePayload(status) {
    if (status === 'completed') {
        return {
            tour: {
                overviewStatus: status,
                completed: { overview: new Date().toISOString() },
            },
        };
    }
    return { tour: { overviewStatus: status } };
}

export function tourCompletedPayload(tourId) {
    return {
        tour: {
            ...(tourId === 'overview' ? { overviewStatus: 'completed' } : {}),
            completed: { [tourId]: new Date().toISOString() },
        },
    };
}
