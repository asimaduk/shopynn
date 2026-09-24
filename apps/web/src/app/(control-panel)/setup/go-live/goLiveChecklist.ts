/** Local checklist for self-serve go-live (web). */

export type GoLiveStepId = 'store' | 'products' | 'receipt' | 'first_sale';

export type GoLiveStep = {
	id: GoLiveStepId;
	title: string;
	description: string;
	href: string;
	cta: string;
};

export const GO_LIVE_STEPS: GoLiveStep[] = [
	{
		id: 'store',
		title: 'Confirm your store',
		description: 'Check the shop name and branch on Company profile / Stores.',
		href: '/apps/settings/account',
		cta: 'Open account settings'
	},
	{
		id: 'products',
		title: 'Add products & stock',
		description: 'Import a CSV or add at least a few products with quantities.',
		href: '/inventory/products',
		cta: 'Go to products'
	},
	{
		id: 'receipt',
		title: 'Receipt preferences',
		description: 'Optional: set thermal printer (DIY is free) or A4 invoice details.',
		href: '/apps/settings/receipt-settings',
		cta: 'Receipt settings'
	},
	{
		id: 'first_sale',
		title: 'Make your first sale',
		description: 'Open the till and complete a cash sale to confirm everything works.',
		href: '/trading/newsale',
		cta: 'New sale'
	}
];

const STORAGE_KEY = 'shopynn:go_live_checklist_v1';

export function readGoLiveDone(): Record<GoLiveStepId, boolean> {
	if (typeof window === 'undefined') {
		return { store: false, products: false, receipt: false, first_sale: false };
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { store: false, products: false, receipt: false, first_sale: false };
		const parsed = JSON.parse(raw);
		return {
			store: Boolean(parsed.store),
			products: Boolean(parsed.products),
			receipt: Boolean(parsed.receipt),
			first_sale: Boolean(parsed.first_sale)
		};
	} catch {
		return { store: false, products: false, receipt: false, first_sale: false };
	}
}

export function writeGoLiveDone(done: Record<GoLiveStepId, boolean>) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
}
