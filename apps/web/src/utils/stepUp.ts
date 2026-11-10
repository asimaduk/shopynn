/**
 * Step-up confirmation for withdrawals and payout changes. When the API answers STEP_UP_REQUIRED the
 * RTK base query calls requestStepUpToken(), <StepUpHost /> asks for the one-time code, and the
 * request is retried with the returned token.
 */
export type StepUpResult = { step_up_token: string; expires_in_seconds: number } | null;

export type StepUpRequest = { id: number; finish: (result: StepUpResult) => void };

type Listener = (request: StepUpRequest | null) => void;

const listeners = new Set<Listener>();
let current: StepUpRequest | null = null;
let pending: Promise<string | null> | null = null;
let cached = { token: '', expiresAt: 0 };

const emit = () => listeners.forEach((fn) => fn(current));

export function subscribeStepUp(fn: Listener) {
	listeners.add(fn);
	fn(current);
	return () => {
		listeners.delete(fn);
	};
}

export function getStepUpToken(): string | null {
	return cached.token && Date.now() < cached.expiresAt - 15000 ? cached.token : null;
}

export function clearStepUpToken() {
	cached = { token: '', expiresAt: 0 };
}

/** Resolves the step-up token, or null if the user cancels. Concurrent callers share one prompt. */
export function requestStepUpToken(): Promise<string | null> {
	if (listeners.size === 0) return Promise.resolve(null);
	if (pending) return pending;
	pending = new Promise((resolve) => {
		current = {
			id: Date.now(),
			finish: (result) => {
				current = null;
				pending = null;
				emit();
				if (result?.step_up_token) {
					cached = {
						token: result.step_up_token,
						expiresAt: Date.now() + Number(result.expires_in_seconds || 0) * 1000
					};
				}
				resolve(result?.step_up_token || null);
			}
		};
		emit();
	});
	return pending;
}
