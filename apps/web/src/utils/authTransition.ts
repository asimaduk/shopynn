const STORAGE_KEY = 'shopynn:auth-transition';
export const AUTH_TRANSITION_EVENT = 'shopynn:auth-transition';

export type AuthTransitionState = {
	active: boolean;
	message: string;
};

const DEFAULT_MESSAGE = 'Signing you in…';

export function getAuthTransition(): AuthTransitionState {
	if (typeof window === 'undefined') {
		return { active: false, message: DEFAULT_MESSAGE };
	}
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return { active: false, message: DEFAULT_MESSAGE };
		const parsed = JSON.parse(raw) as Partial<AuthTransitionState>;
		return {
			active: Boolean(parsed.active),
			message: parsed.message || DEFAULT_MESSAGE
		};
	} catch {
		return { active: false, message: DEFAULT_MESSAGE };
	}
}

function emit(state: AuthTransitionState) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(AUTH_TRANSITION_EVENT, { detail: state }));
}

export function startAuthTransition(message = DEFAULT_MESSAGE) {
	if (typeof window === 'undefined') return;
	const state: AuthTransitionState = { active: true, message };
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	emit(state);
}

export function updateAuthTransition(message: string) {
	if (typeof window === 'undefined') return;
	const current = getAuthTransition();
	if (!current.active) return;
	const state: AuthTransitionState = { active: true, message };
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	emit(state);
}

export function endAuthTransition() {
	if (typeof window === 'undefined') return;
	sessionStorage.removeItem(STORAGE_KEY);
	emit({ active: false, message: DEFAULT_MESSAGE });
}
