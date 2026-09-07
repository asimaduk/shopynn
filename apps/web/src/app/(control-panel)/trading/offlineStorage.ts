export function safeParseJson<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function readLocalJson<T>(key: string, fallback: T): T {
	if (typeof window === 'undefined') return fallback;
	const parsed = safeParseJson<T>(window.localStorage.getItem(key));
	return parsed == null ? fallback : parsed;
}

export function writeLocalJson<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(key, JSON.stringify(value));
}

