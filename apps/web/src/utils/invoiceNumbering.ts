/** Device-local invoice numbering: INV-{register}-{n} (offline-safe with register code). */

const STORAGE_KEY = 'shopynn.invoiceNumbering';

export const DEFAULT_INVOICE_PREFIX = 'INV';
export const DEFAULT_INVOICE_REGISTER_CODE = 'W';
export const DEFAULT_INVOICE_NEXT_NUMBER = 1001;

export type InvoiceNumberingConfig = {
	prefix: string;
	registerCode: string;
	nextNumber: number;
};

/** Uppercase A–Z / 0–9, max 4 chars. Empty string if invalid. */
export function normalizeInvoiceRegisterCode(raw: unknown): string {
	return String(raw ?? '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, 4);
}

export function normalizeInvoicePrefix(raw: unknown): string {
	const p = String(raw ?? '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, 8);
	return p || DEFAULT_INVOICE_PREFIX;
}

export function normalizeInvoiceNextNumber(raw: unknown): number {
	const n = parseInt(String(raw ?? '').trim(), 10);
	if (!Number.isFinite(n) || n < 0) return DEFAULT_INVOICE_NEXT_NUMBER;
	return n;
}

export function formatInvoiceNumber(parts: {
	prefix?: string;
	registerCode?: string;
	number?: number | string;
}): string {
	const prefix = normalizeInvoicePrefix(parts.prefix);
	const register = normalizeInvoiceRegisterCode(parts.registerCode);
	const num = normalizeInvoiceNextNumber(parts.number);
	return register ? `${prefix}-${register}-${num}` : `${prefix}-${num}`;
}

export function loadInvoiceNumberingConfig(): InvoiceNumberingConfig {
	if (typeof window === 'undefined') {
		return {
			prefix: DEFAULT_INVOICE_PREFIX,
			registerCode: DEFAULT_INVOICE_REGISTER_CODE,
			nextNumber: DEFAULT_INVOICE_NEXT_NUMBER
		};
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return {
				prefix: DEFAULT_INVOICE_PREFIX,
				registerCode: DEFAULT_INVOICE_REGISTER_CODE,
				nextNumber: DEFAULT_INVOICE_NEXT_NUMBER
			};
		}
		const parsed = JSON.parse(raw) as Partial<InvoiceNumberingConfig>;
		return {
			prefix: normalizeInvoicePrefix(parsed.prefix),
			registerCode:
				normalizeInvoiceRegisterCode(parsed.registerCode) || DEFAULT_INVOICE_REGISTER_CODE,
			nextNumber: normalizeInvoiceNextNumber(parsed.nextNumber)
		};
	} catch {
		return {
			prefix: DEFAULT_INVOICE_PREFIX,
			registerCode: DEFAULT_INVOICE_REGISTER_CODE,
			nextNumber: DEFAULT_INVOICE_NEXT_NUMBER
		};
	}
}

export function saveInvoiceNumberingConfig(
	partial: Partial<{ prefix: string; registerCode: string; nextNumber: number | string }>
): InvoiceNumberingConfig {
	const current = loadInvoiceNumberingConfig();
	const next: InvoiceNumberingConfig = {
		prefix:
			partial.prefix !== undefined ? normalizeInvoicePrefix(partial.prefix) : current.prefix,
		registerCode:
			partial.registerCode !== undefined
				? normalizeInvoiceRegisterCode(partial.registerCode) || DEFAULT_INVOICE_REGISTER_CODE
				: current.registerCode,
		nextNumber:
			partial.nextNumber !== undefined
				? normalizeInvoiceNextNumber(partial.nextNumber)
				: current.nextNumber
	};
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}
	return next;
}

/** Peek next invoice number without consuming the counter. */
export function peekNextInvoiceNumber(config?: InvoiceNumberingConfig): string {
	const c = config || loadInvoiceNumberingConfig();
	return formatInvoiceNumber({
		prefix: c.prefix,
		registerCode: c.registerCode,
		number: c.nextNumber
	});
}

/** Allocate current number and bump local counter for the next sale. */
export function allocateNextInvoiceNumber(): string {
	const c = loadInvoiceNumberingConfig();
	const invoiceNumber = formatInvoiceNumber({
		prefix: c.prefix,
		registerCode: c.registerCode,
		number: c.nextNumber
	});
	saveInvoiceNumberingConfig({ nextNumber: c.nextNumber + 1 });
	return invoiceNumber;
}
