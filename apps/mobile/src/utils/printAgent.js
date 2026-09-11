/**
 * Local Shopynn Print agent (USB thermal on a checkout PC).
 * Host is the PC running the agent — not a network printer IP.
 */

export const DEFAULT_PRINT_AGENT_HOST = '127.0.0.1';
export const DEFAULT_PRINT_AGENT_PORT = 3001;

export function normalizePrintAgentHost(raw) {
    let host = String(raw || '').trim();
    if (!host) return '';
    host = host.replace(/^https?:\/\//i, '');
    host = host.replace(/\/.*$/, '');
    host = host.replace(/:\d+$/, '');
    return host.trim();
}

export function normalizePrintAgentPort(raw) {
    const n = parseInt(String(raw ?? '').trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return DEFAULT_PRINT_AGENT_PORT;
    return n;
}

/** @returns {string|null} base URL without trailing slash, or null if host missing */
export function getPrintAgentBaseUrl(appSettings) {
    const host = normalizePrintAgentHost(appSettings?.printAgentHost);
    if (!host) return null;
    const port = normalizePrintAgentPort(appSettings?.printAgentPort);
    return `http://${host}:${port}`;
}

export function getPrintAgentPrintUrl(appSettings) {
    const base = getPrintAgentBaseUrl(appSettings);
    return base ? `${base}/print` : null;
}

export function getPrintAgentHealthUrl(appSettings) {
    const base = getPrintAgentBaseUrl(appSettings);
    return base ? `${base}/health` : null;
}
