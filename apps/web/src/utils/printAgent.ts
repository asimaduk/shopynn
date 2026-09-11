const STORAGE_KEY = 'shopynn.printAgent';

export const DEFAULT_PRINT_AGENT_HOST = '127.0.0.1';
export const DEFAULT_PRINT_AGENT_PORT = 3001;

export type PrintAgentConfig = {
	host: string;
	port: number;
};

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

export function loadPrintAgentConfig(): PrintAgentConfig {
	if (typeof window === 'undefined') {
		return { host: DEFAULT_PRINT_AGENT_HOST, port: DEFAULT_PRINT_AGENT_PORT };
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { host: DEFAULT_PRINT_AGENT_HOST, port: DEFAULT_PRINT_AGENT_PORT };
		const parsed = JSON.parse(raw) as { host?: string; port?: number | string };
		return {
			host: normalizePrintAgentHost(parsed.host) || DEFAULT_PRINT_AGENT_HOST,
			port: normalizePrintAgentPort(parsed.port)
		};
	} catch {
		return { host: DEFAULT_PRINT_AGENT_HOST, port: DEFAULT_PRINT_AGENT_PORT };
	}
}

export function savePrintAgentConfig(config: { host?: string; port?: number | string }): PrintAgentConfig {
	const next: PrintAgentConfig = {
		host: normalizePrintAgentHost(config.host) || DEFAULT_PRINT_AGENT_HOST,
		port: normalizePrintAgentPort(config.port)
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
