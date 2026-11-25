/** In-app Shopynn Print installer manifest (S3 + local public fallback). */

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

/** Public S3 manifest written by `npm run publish:release -w @shopynn/print`. */
export const PRINT_AGENT_CDN_MANIFEST_URL =
	'https://ims-products-images-bucket.s3.amazonaws.com/print-agent/latest.json';

const LOCAL_MANIFEST_PATH = '/downloads/print-agent/latest.json';

function remoteManifestUrl(): string | null {
	const fromEnv = String(process.env.NEXT_PUBLIC_PRINT_AGENT_MANIFEST_URL || '').trim();
	return fromEnv || null;
}

export async function fetchPrintAgentManifest(): Promise<PrintAgentManifest | null> {
	const candidates = [
		remoteManifestUrl(),
		PRINT_AGENT_CDN_MANIFEST_URL,
		LOCAL_MANIFEST_PATH
	].filter(Boolean) as string[];
	for (const url of candidates) {
		try {
			const res = await fetch(url, { cache: 'no-store' });
			if (!res.ok) continue;
			const data = (await res.json()) as PrintAgentManifest;
			if (!data?.version || !data?.platforms) continue;
			return data;
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
