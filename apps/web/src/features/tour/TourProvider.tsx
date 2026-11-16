'use client';

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react';
import { useRouter } from 'next/navigation';
import useUser from '@auth/useUser';
import {
	useGetMePreferencesQuery,
	useUpdateMePreferencesMutation
} from 'src/app/(control-panel)/apps/profile/ProfileApi';
import TourCatalogDialog from './TourCatalogDialog';
import TourWelcomeDialog from './TourWelcomeDialog';
import type { TourId } from './tourIds';
import {
	hasTakenAnyTour,
	overviewDonePayload,
	readTourPreferences,
	tourCompletedPayload,
	type TourPreferences
} from './tourPreferences';
import { startTour, stopTour } from './startTour';

type TourContextValue = {
	openCatalog: () => void;
	startTourById: (tourId: TourId) => void;
	tourPrefs: TourPreferences;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
	const ctx = useContext(TourContext);
	if (!ctx) {
		throw new Error('useTour must be used within TourProvider');
	}
	return ctx;
}

/** Safe for chrome that may render outside the provider in edge cases. */
export function useTourOptional(): TourContextValue | null {
	return useContext(TourContext);
}

type Props = { children: ReactNode };

export default function TourProvider({ children }: Props) {
	const router = useRouter();
	const { data: user, isGuest } = useUser();
	// Session `db` omits `id` (stored as session.user_id). Auth is via bearer token, so skip on user presence only.
	const {
		data: preferences,
		isSuccess,
		isError
	} = useGetMePreferencesQuery(undefined, {
		skip: !user || isGuest
	});
	const [updateMePreferences] = useUpdateMePreferencesMutation();
	const [catalogOpen, setCatalogOpen] = useState(false);
	const [welcomeOpen, setWelcomeOpen] = useState(false);
	const [localTour, setLocalTour] = useState<TourPreferences | null>(null);
	const welcomeOfferedRef = useRef(false);
	const pendingTourRef = useRef<TourId | null>(null);

	const tourPrefs = useMemo(() => {
		const fromServer = readTourPreferences((preferences ?? null) as Record<string, unknown> | null);
		if (!localTour) return fromServer;
		return {
			overviewStatus: localTour.overviewStatus ?? fromServer.overviewStatus,
			completed: { ...fromServer.completed, ...localTour.completed }
		};
	}, [preferences, localTour]);

	/** Prefs loaded (or failed) enough to decide whether to auto-offer the tour. */
	const prefsReady = isSuccess || isError;

	const persist = useCallback(
		async (body: Record<string, unknown>) => {
			const patch = body.tour as TourPreferences | undefined;
			if (patch) {
				setLocalTour((prev) => ({
					overviewStatus: patch.overviewStatus ?? prev?.overviewStatus,
					completed: { ...prev?.completed, ...patch.completed }
				}));
			}
			try {
				await updateMePreferences(body).unwrap();
			} catch {
				/* tour should not block the app if prefs fail */
			}
		},
		[updateMePreferences]
	);

	const navigate = useCallback(
		(path: string) => {
			router.push(path);
		},
		[router]
	);

	const startTourById = useCallback(
		(tourId: TourId) => {
			void startTour({
				tourId,
				navigate,
				onComplete: () => {
					void persist(tourCompletedPayload(tourId));
				},
				onSkip: () => {
					if (tourId === 'overview') {
						void persist(overviewDonePayload('skipped'));
					}
				}
			});
		},
		[navigate, persist]
	);

	const openCatalog = useCallback(() => setCatalogOpen(true), []);

	const queuePendingTour = useCallback(() => {
		const tourId = pendingTourRef.current;
		pendingTourRef.current = null;
		if (tourId) {
			// Let the dialog/modal unmount before driver mounts above the page.
			window.setTimeout(() => startTourById(tourId), 50);
		}
	}, [startTourById]);

	const queueTourAfterDialog = useCallback((tourId: TourId) => {
		pendingTourRef.current = tourId;
		setCatalogOpen(false);
		setWelcomeOpen(false);
	}, []);

	useEffect(() => {
		if (!prefsReady || welcomeOfferedRef.current || isGuest || !user) return;
		if (hasTakenAnyTour(tourPrefs)) return;

		// Set the ref only when opening — Strict Mode remount clears the timer first.
		const timer = window.setTimeout(() => {
			welcomeOfferedRef.current = true;
			setWelcomeOpen(true);
		}, 700);
		return () => window.clearTimeout(timer);
	}, [prefsReady, isGuest, user, tourPrefs]);

	useEffect(() => () => stopTour(), []);

	const handleWelcomeStart = useCallback(() => {
		queueTourAfterDialog('overview');
	}, [queueTourAfterDialog]);

	const handleWelcomeDontShowAgain = useCallback(() => {
		setWelcomeOpen(false);
		void persist(overviewDonePayload('skipped'));
	}, [persist]);

	const handleWelcomeDismiss = useCallback(() => {
		setWelcomeOpen(false);
	}, []);

	const value = useMemo(
		() => ({ openCatalog, startTourById, tourPrefs }),
		[openCatalog, startTourById, tourPrefs]
	);

	return (
		<TourContext.Provider value={value}>
			{children}
			<TourWelcomeDialog
				open={welcomeOpen}
				onStart={handleWelcomeStart}
				onDontShowAgain={handleWelcomeDontShowAgain}
				onDismiss={handleWelcomeDismiss}
				onExited={queuePendingTour}
			/>
			<TourCatalogDialog
				open={catalogOpen}
				onClose={() => setCatalogOpen(false)}
				tourPrefs={tourPrefs}
				onStart={queueTourAfterDialog}
				onExited={queuePendingTour}
			/>
		</TourContext.Provider>
	);
}
