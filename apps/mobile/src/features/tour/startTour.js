import { InteractionManager } from 'react-native';
import { rootNavigationRef } from '../../navigators/main';
import { waitForTourAnchor } from './tourAnchors';

let activeController = null;
let runToken = 0;

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureNav(nav) {
    if (!nav || !rootNavigationRef.isReady()) return;
    try {
        if (nav.type === 'tab') {
            rootNavigationRef.navigate('Home', { screen: nav.screen });
        } else if (nav.type === 'stack') {
            rootNavigationRef.navigate(nav.screen);
        }
    } catch {
        /* navigation may fail if screen gated */
    }
    await wait(280);
    await new Promise((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
    });
}

/**
 * Drives a filtered tour definition through the overlay controller.
 * Prepares each step (nav + measure) before painting once, so the coachmark
 * does not flash in the center and then jump to the spotlight.
 */
export async function startTour(options) {
    const { definition, setOverlayState, onComplete, onSkip } = options;
    if (!definition?.steps?.length) {
        onSkip?.();
        return;
    }

    if (activeController) {
        activeController.abort();
        activeController = null;
    }

    const token = ++runToken;
    let aborted = false;
    let busy = false;
    const steps = definition.steps;

    const controller = {
        abort() {
            aborted = true;
            if (token === runToken) setOverlayState(null);
        },
    };
    activeController = controller;

    const settle = (kind) => {
        if (aborted) return;
        aborted = true;
        if (activeController === controller) activeController = null;
        setOverlayState(null);
        if (kind === 'complete') onComplete?.();
        else onSkip?.();
    };

    const bindHandlers = (i) => ({
        onNext: () => {
            if (aborted || token !== runToken || busy) return;
            if (i >= steps.length - 1) {
                settle('complete');
                return;
            }
            void showStep(i + 1);
        },
        onBack: () => {
            if (aborted || token !== runToken || busy) return;
            if (i <= 0) return;
            void showStep(i - 1);
        },
        onSkip: () => {
            if (busy) return;
            settle('skip');
        },
    });

    const paint = (i, rect) => {
        if (aborted || token !== runToken) return;
        const step = steps[i];
        if (!step) {
            settle('complete');
            return;
        }
        setOverlayState({
            visible: true,
            step,
            stepIndex: i,
            stepCount: steps.length,
            rect: rect || null,
            preparing: false,
            ...bindHandlers(i),
        });
    };

    const showStep = async (i) => {
        if (aborted || token !== runToken) return;
        const step = steps[i];
        if (!step) {
            settle('complete');
            return;
        }

        busy = true;
        // Keep the previous coachmark visible; mark preparing so Next is ignored.
        setOverlayState((prev) =>
            prev
                ? { ...prev, preparing: true, onNext: () => {}, onBack: () => {} }
                : prev,
        );

        try {
            if (step.nav) {
                await ensureNav(step.nav);
                if (aborted || token !== runToken) return;
            }

            let rect = null;
            if (step.anchor) {
                rect = await waitForTourAnchor(step.anchor, 2200);
                if (aborted || token !== runToken) return;
            }

            // Single paint in the final position (centered only when no usable rect).
            paint(i, rect);
        } finally {
            busy = false;
        }
    };

    await showStep(0);
}

export function stopTour(setOverlayState) {
    runToken += 1;
    if (activeController) {
        activeController.abort();
        activeController = null;
    }
    setOverlayState?.(null);
}
