/**
 * Step-up confirmation for withdrawals and payout changes. When the API answers STEP_UP_REQUIRED the
 * interceptor calls requestStepUpToken(), <StepUpHost /> asks for the one-time code, and the request
 * is retried with the returned token. Like AppAlert, hosts are overlays: the most recently mounted
 * one (e.g. inside an AppModal) renders the prompt.
 */
const hosts = [];
let current = null;
let pending = null;
let cached = { token: null, expiresAt: 0 };

const emit = () => {
    hosts.forEach((fn, i) => fn(i === hosts.length - 1 ? current : null));
};

export const subscribeStepUp = (fn) => {
    hosts.push(fn);
    emit();
    return () => {
        const idx = hosts.lastIndexOf(fn);
        if (idx !== -1) hosts.splice(idx, 1);
        emit();
    };
};

/** A confirmed token that is still valid for at least a few more seconds, else null. */
export const getStepUpToken = () =>
    cached.token && Date.now() < cached.expiresAt - 15000 ? cached.token : null;

export const clearStepUpToken = () => {
    cached = { token: null, expiresAt: 0 };
};

/** Resolves the step-up token, or null if the user cancels. Concurrent callers share one prompt. */
export const requestStepUpToken = () => {
    if (!hosts.length) return Promise.resolve(null);
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
                        expiresAt: Date.now() + Number(result.expires_in_seconds || 0) * 1000,
                    };
                }
                resolve(result?.step_up_token || null);
            },
        };
        emit();
    });
    return pending;
};
