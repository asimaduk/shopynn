import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { users as usersApi } from '../../services/api';
import { filterTourCatalog, getFilteredTourDefinition, userHasShopTourAccess } from './filterTours';
import {
    hasTakenAnyTour,
    overviewDonePayload,
    readTourPreferences,
    tourCompletedPayload,
} from './tourPreferences';
import { startTour, stopTour } from './startTour';
import TourCatalogModal from './TourCatalogModal';
import TourOverlay from './TourOverlay';
import TourWelcomeModal from './TourWelcomeModal';

const TourContext = createContext(null);

export function useTour() {
    const ctx = useContext(TourContext);
    if (!ctx) {
        throw new Error('useTour must be used within TourProvider');
    }
    return ctx;
}

export function useTourOptional() {
    return useContext(TourContext);
}

export default function TourProvider({ children }) {
    const user = useSelector(({ user: u }) => u);
    const isLoggedIn = Boolean(user?.isLoggedIn);

    const [tourPrefs, setTourPrefs] = useState({});
    const [prefsReady, setPrefsReady] = useState(false);
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [welcomeOpen, setWelcomeOpen] = useState(false);
    const [overlayState, setOverlayState] = useState(null);
    const welcomeOfferedRef = useRef(false);

    const catalog = useMemo(() => filterTourCatalog(user), [user]);
    const hasShopTours = useMemo(() => userHasShopTourAccess(user), [user]);

    useEffect(() => {
        if (!isLoggedIn) {
            setPrefsReady(false);
            setTourPrefs({});
            welcomeOfferedRef.current = false;
            setWelcomeOpen(false);
            setCatalogOpen(false);
            setOverlayState(null);
            return undefined;
        }
        let cancelled = false;
        setPrefsReady(false);
        usersApi
            .mePreferences()
            .then((data) => {
                if (cancelled) return;
                setTourPrefs(readTourPreferences(data));
            })
            .catch(() => {
                if (cancelled) return;
                setTourPrefs({});
            })
            .finally(() => {
                if (!cancelled) setPrefsReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [isLoggedIn, user?.id]);

    const persist = useCallback(async (body) => {
        const patch = body?.tour;
        if (patch) {
            setTourPrefs((prev) => ({
                overviewStatus: patch.overviewStatus ?? prev?.overviewStatus,
                completed: { ...prev?.completed, ...patch.completed },
            }));
        }
        try {
            await usersApi.updateMePreferences(body);
        } catch {
            /* tour should not block the app */
        }
    }, []);

    const startTourById = useCallback(
        (tourId) => {
            const definition = getFilteredTourDefinition(tourId, user);
            if (!definition) return;
            setCatalogOpen(false);
            setWelcomeOpen(false);
            // Let other sheets finish dismissing before coachmarks start.
            InteractionManager.runAfterInteractions(() => {
                void startTour({
                    definition,
                    setOverlayState,
                    onComplete: () => {
                        void persist(tourCompletedPayload(tourId));
                    },
                    onSkip: () => {
                        if (tourId === 'overview') {
                            void persist(overviewDonePayload('skipped'));
                        }
                    },
                });
            });
        },
        [persist, user],
    );

    const openCatalog = useCallback(() => {
        setWelcomeOpen(false);
        setCatalogOpen(true);
    }, []);

    useEffect(() => {
        if (!prefsReady || !isLoggedIn || welcomeOfferedRef.current) return undefined;
        if (!hasShopTours) return undefined;
        if (hasTakenAnyTour(tourPrefs)) return undefined;

        // Wait for post-login sheets (push prompt, etc.) before offering the tour.
        let timer;
        const handle = InteractionManager.runAfterInteractions(() => {
            timer = setTimeout(() => {
                if (welcomeOfferedRef.current) return;
                welcomeOfferedRef.current = true;
                setWelcomeOpen(true);
            }, 2200);
        });
        return () => {
            handle?.cancel?.();
            if (timer) clearTimeout(timer);
        };
    }, [prefsReady, isLoggedIn, hasShopTours, tourPrefs]);

    useEffect(
        () => () => {
            stopTour(setOverlayState);
        },
        [],
    );

    const value = useMemo(
        () => ({
            openCatalog,
            startTourById,
            tourPrefs,
            catalog,
            hasShopTours,
        }),
        [openCatalog, startTourById, tourPrefs, catalog, hasShopTours],
    );

    return (
        <TourContext.Provider value={value}>
            <View style={styles.root}>
                {children}
                <TourWelcomeModal
                    visible={welcomeOpen}
                    onStart={() => startTourById('overview')}
                    onDontShowAgain={() => {
                        setWelcomeOpen(false);
                        void persist(overviewDonePayload('skipped'));
                    }}
                    onDismiss={() => setWelcomeOpen(false)}
                />
                <TourCatalogModal
                    visible={catalogOpen}
                    onClose={() => setCatalogOpen(false)}
                    catalog={catalog}
                    tourPrefs={tourPrefs}
                    onStart={startTourById}
                />
                {overlayState ? (
                    <TourOverlay
                        visible={overlayState.visible}
                        step={overlayState.step}
                        stepIndex={overlayState.stepIndex}
                        stepCount={overlayState.stepCount}
                        rect={overlayState.rect}
                        onNext={overlayState.onNext}
                        onBack={overlayState.onBack}
                        onSkip={overlayState.onSkip}
                    />
                ) : null}
            </View>
        </TourContext.Provider>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
});
