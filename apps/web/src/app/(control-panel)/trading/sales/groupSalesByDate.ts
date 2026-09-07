import type { Sale } from '../TradingApi';

function startOfLocalDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatSaleSectionDate(d: Date): string {
	const now = new Date();
	const today = startOfLocalDay(now);
	const yesterday = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
	const day = startOfLocalDay(d);
	if (day.getTime() === today.getTime()) return 'Today';
	if (day.getTime() === yesterday.getTime()) return 'Yesterday';
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function groupSalesByDate(sales: Sale[]): { label: string; sortKey: string; items: Sale[] }[] {
	const map = new Map<string, Sale[]>();
	for (const s of sales) {
		const d = new Date(s.created_at);
		const sod = startOfLocalDay(d);
		const key = sod.toISOString();
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(s);
	}
	const entries = [...map.entries()].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
	return entries.map(([isoKey, items]) => ({
		label: formatSaleSectionDate(new Date(isoKey)),
		sortKey: isoKey,
		items: [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	}));
}
