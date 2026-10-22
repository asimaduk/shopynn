const STORAGE_KEY = 'shopynn.printAgent';

export const DEFAULT_PRINT_AGENT_HOST = '127.0.0.1';
export const DEFAULT_PRINT_AGENT_PORT = 3001;

export type PrintAgentConfig = {
	host: string;
	port: number;
	/** Pairing code printed by the agent; sent as X-Print-Key. */
	key: string;
};

const DEFAULT_CONFIG: PrintAgentConfig = { host: DEFAULT_PRINT_AGENT_HOST, port: DEFAULT_PRINT_AGENT_PORT, key: '' };

export function normalizePrintAgentHost(raw: unknown): string {
	let host = String(raw || '').trim();
	if (!host) return '';
	host = host.replace(/^https?:\/\//i, '');
	host = host.replace(/\/.*$/, '');
	host = host.replace(/:\d+$/, '');
	return host.trim();
}

export function normalizePrintAgentPort(raw: unknown): number {
	const n = parseInt(String(raw ?? '').trim(), 10);
	if (!Number.isInteger(n) || n < 1 || n > 65535) return DEFAULT_PRINT_AGENT_PORT;
	return n;
}

export function normalizePrintAgentKey(raw: unknown): string {
	return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function loadPrintAgentConfig(): PrintAgentConfig {
	if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_CONFIG };
		const parsed = JSON.parse(raw) as { host?: string; port?: number | string; key?: string };
		return {
			host: normalizePrintAgentHost(parsed.host) || DEFAULT_PRINT_AGENT_HOST,
			port: normalizePrintAgentPort(parsed.port),
			key: normalizePrintAgentKey(parsed.key)
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export function savePrintAgentConfig(config: {
	host?: string;
	port?: number | string;
	key?: string;
}): PrintAgentConfig {
	const next: PrintAgentConfig = {
		host: normalizePrintAgentHost(config.host) || DEFAULT_PRINT_AGENT_HOST,
		port: normalizePrintAgentPort(config.port),
		key: normalizePrintAgentKey(config.key)
	};
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}
	return next;
}

export function getPrintAgentPrintUrl(config?: PrintAgentConfig): string {
	const c = config || loadPrintAgentConfig();
	return `http://${c.host}:${c.port}/print`;
}

export function getPrintAgentHealthUrl(config?: PrintAgentConfig): string {
	const c = config || loadPrintAgentConfig();
	return `http://${c.host}:${c.port}/health`;
}

export function getPrintAgentPairUrl(config?: PrintAgentConfig): string {
	const c = config || loadPrintAgentConfig();
	return `http://${c.host}:${c.port}/pair`;
}

export function printAgentHeaders(
	config?: PrintAgentConfig,
	extra: Record<string, string> = {}
): Record<string, string> {
	const key = normalizePrintAgentKey((config || loadPrintAgentConfig()).key);
	return key ? { ...extra, 'X-Print-Key': key } : { ...extra };
}
