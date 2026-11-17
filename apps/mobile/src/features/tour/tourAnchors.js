import { Dimensions } from 'react-native';

const anchors = new Map();
/** Optional: () => Promise<void> | void — scroll so the anchor is on screen. */
const scrollHandlers = new Map();

export function registerTourAnchor(id, ref) {
    if (!id || !ref) return;
    anchors.set(id, ref);
}

export function unregisterTourAnchor(id, ref) {
    if (!id) return;
    if (!ref || anchors.get(id) === ref) {
        anchors.delete(id);
    }
}

export function registerTourScrollIntoView(id, handler) {
    if (!id || typeof handler !== 'function') return;
    scrollHandlers.set(id, handler);
}

export function unregisterTourScrollIntoView(id) {
    if (!id) return;
    scrollHandlers.delete(id);
}

function isFiniteRect(rect) {
    if (!rect) return false;
    return (
        Number.isFinite(rect.x) &&
        Number.isFinite(rect.y) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height) &&
        rect.width > 0 &&
        rect.height > 0
    );
}

/** True when most of the rect is inside the window. */
export function isRectOnScreen(rect) {
    if (!isFiniteRect(rect)) return false;
    const { width: winW, height: winH } = Dimensions.get('window');
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    return cx >= 0 && cx <= winW && cy >= 0 && cy <= winH;
}

/**
 * @returns {Promise<{ x: number, y: number, width: number, height: number } | null>}
 */
export function measureTourAnchor(id) {
    return new Promise((resolve) => {
        const ref = anchors.get(id);
        const node = ref?.current;
        if (!node || typeof node.measureInWindow !== 'function') {
            resolve(null);
            return;
        }
        try {
            node.measureInWindow((x, y, width, height) => {
                const rect = { x, y, width, height };
                resolve(isFiniteRect(rect) ? rect : null);
            });
        } catch {
            resolve(null);
        }
    });
}

export async function waitForTourAnchor(id, timeoutMs = 2500) {
    const started = Date.now();
    let scrolled = false;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        let rect = await measureTourAnchor(id);
        if (rect && isRectOnScreen(rect)) return rect;

        // Off-screen but registered — ask the host to scroll once.
        if (rect && !scrolled) {
            const scroll = scrollHandlers.get(id);
            if (scroll) {
                scrolled = true;
                try {
                    await Promise.resolve(scroll());
                    await new Promise((r) => setTimeout(r, 280));
                    rect = await measureTourAnchor(id);
                    if (rect && isRectOnScreen(rect)) return rect;
                } catch {
                    /* ignore scroll errors */
                }
            }
        }

        if (Date.now() - started >= timeoutMs) {
            // Prefer an off-screen rect over null so callers can still decide;
            // usually we return null and show a centered coachmark instead.
            return null;
        }
        await new Promise((r) => setTimeout(r, 80));
    }
}
