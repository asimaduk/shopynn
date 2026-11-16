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
import { isBillingAdminUser } from '@auth/permissions';
import {
	useGetMePreferencesQuery,
	useUpdateMePreferencesMutation
} from 'src/app/(control-panel)/apps/profile/ProfileApi';
import TourCatalogDialog from './TourCatalogDialog';
import type { TourId } from './tourIds';
import {
	isOverviewPending,
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
	const { data: preferences, isSuccess } = useGetMePreferencesQuery(undefined, {
		skip: !user?.id || isGuest
	});
	const [updateMePreferences] = useUpdateMePreferencesMutation();
	const [catalogOpen, setCatalogOpen] = useState(false);
	const [localTour, setLocalTour] = useState<TourPreferences | null>(null);
	const autoStartedRef = useRef(false);

	const tourPrefs = useMemo(() => {
		const fromServer = readTourPreferences((preferences ?? null) as Record<string, unknown> | null);
		if (!localTour) return fromServer;
		return {
			overviewStatus: localTour.overviewStatus ?? fromServer.overviewStatus,
			completed: { ...fromServer.completed, ...localTour.completed }
		};
	}, [preferences, localTour]);

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

	useEffect(() => {
		if (!isSuccess || autoStartedRef.current || isGuest || !user) return;
		if (!isBillingAdminUser(user)) return;
		if (!isOverviewPending(tourPrefs)) return;

		autoStartedRef.current = true;
		const timer = window.setTimeout(() => startTourById('overview'), 900);
		return () => window.clearTimeout(timer);
	}, [isSuccess, isGuest, user, tourPrefs, startTourById]);

	useEffect(() => () => stopTour(), []);

	const value = useMemo(
		() => ({ openCatalog, startTourById, tourPrefs }),
		[openCatalog, startTourById, tourPrefs]
	);

	return (
		<TourContext.Provider value={value}>
			{children}
			<TourCatalogDialog
				open={catalogOpen}
				onClose={() => setCatalogOpen(false)}
				tourPrefs={tourPrefs}
				onStart={startTourById}
			/>
		</TourContext.Provider>
	);
}
