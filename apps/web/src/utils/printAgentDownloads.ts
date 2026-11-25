/** In-app Shopynn Print installer manifest (API proxy — no object-storage URLs). */

import { URLS } from '@/configs/settingsConfig';

export type PrintAgentPlatformId = 'macos' | 'windows';

export type PrintAgentPlatform = {
	filename: string;
	url: string;
	sha256: string;
	size?: number;
};

export type PrintAgentManifest = {
	schema_version: number;
	name: string;
	version: string;
	published_at?: string;
	zadig_url?: string;
	notes?: string;
	platforms: Partial<Record<PrintAgentPlatformId, PrintAgentPlatform>>;
};

export const PRINT_AGENT_ZADIG_URL = 'https://zadig.akeo.ie/';
export const PRINT_AGENT_RECEIPT_SETTINGS_PATH = '/apps/settings/receipt-settings';

const LOCAL_MANIFEST_PATH = '/downloads/print-agent/latest.json';

function apiManifestUrl(): string {
	return `${URLS.serverUrl}/public/print-agent/latest`;
}

function withApiDownloadUrls(manifest: PrintAgentManifest): PrintAgentManifest {
	const platforms: PrintAgentManifest['platforms'] = {};
	for (const id of ['macos', 'windows'] as const) {
		const row = manifest.platforms?.[id];
		if (!row?.filename) continue;
		platforms[id] = {
			...row,
			url: `${URLS.serverUrl}/public/print-agent/download/${id}`
		};
	}
	return { ...manifest, platforms };
}

function parseManifestPayload(json: unknown): PrintAgentManifest | null {
	const root = json as { data?: PrintAgentManifest } & PrintAgentManifest;
	const data = (root?.data && typeof root.data === 'object' ? root.data : root) as PrintAgentManifest;
	if (!data?.version || !data?.platforms) return null;
	return withApiDownloadUrls(data);
}

export async function fetchPrintAgentManifest(): Promise<PrintAgentManifest | null> {
	const candidates = [
		String(process.env.NEXT_PUBLIC_PRINT_AGENT_MANIFEST_URL || '').trim() || null,
		apiManifestUrl(),
		LOCAL_MANIFEST_PATH
	].filter(Boolean) as string[];

	for (const url of candidates) {
		try {
			const res = await fetch(url, { cache: 'no-store' });
			if (!res.ok) continue;
			const parsed = parseManifestPayload(await res.json());
			if (parsed) return parsed;
		} catch {
			/* try next */
		}
	}
	return null;
}

export function formatPrintAgentBytes(size?: number): string {
	const n = Number(size || 0);
	if (!Number.isFinite(n) || n <= 0) return '';
	if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
