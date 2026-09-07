const formatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' });

export function formatCurrency(value: number | string | null | undefined): string {
	const n = Number(value);
	if (Number.isNaN(n)) return '—';
	return formatter.format(n).replace('GH₵', 'GHS ');
}

export type ReportCard = { label: string; value: string; color?: string };
export type ReportRow = Record<string, string | number | null | undefined>;

export function mapProfitLoss(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	if (!data) return { cards: [], rows: [] };
	return {
		cards: [
			{ label: 'Revenue', value: formatCurrency(data.revenue), color: '#10b981' },
			{ label: 'Expenses', value: formatCurrency(data.expenses), color: '#ef4444' },
			{ label: 'Net profit', value: formatCurrency(data.netProfit), color: '#6366f1' },
			{ label: 'Total sold units', value: String(data.totalSoldQty ?? '—'), color: '#f59e0b' }
		],
		rows: [
			{ Item: 'COGS', Amount: formatCurrency(data.cogs) },
			{ Item: 'Gross profit', Amount: formatCurrency(data.grossProfit) }
		]
	};
}

export function mapStockSummary(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	if (!data) return { cards: [], rows: [] };
	const items = Array.isArray(data.items) ? data.items : [];
	return {
		cards: [
			{ label: 'Products', value: String(data.inventoryCount ?? 0), color: '#7c3aed' },
			{ label: 'Total units', value: String(data.totalUnits ?? 0), color: '#10b981' },
			{ label: 'Stock value', value: formatCurrency(data.stockValue), color: '#f59e0b' },
			{ label: 'Low stock', value: String(data.lowStockCount ?? 0), color: '#ef4444' }
		],
		rows: items.map((it: any) => ({
			Product: it.product_name ?? it.name ?? '—',
			Warehouse: it.warehouse_name ?? it.store_name ?? '—',
			SKU: it.sku ?? '—',
			Qty: it.quantity_available ?? it.qty ?? '—',
			Value: formatCurrency(it.stock_value ?? it.value)
		}))
	};
}

export function mapSalesSummary(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	if (!data?.overall) return { cards: [], rows: [] };
	const o = data.overall;
	return {
		cards: [
			{ label: 'Total sales', value: formatCurrency(o.totalSales), color: '#10b981' },
			{ label: 'Transactions', value: String(o.transactionCount ?? 0), color: '#6366f1' },
			{ label: 'Avg per sale', value: formatCurrency(o.averagePerSale), color: '#f59e0b' }
		],
		rows: [
			{ Period: 'This week', Amount: formatCurrency(data.thisWeek?.totalSales), Count: data.thisWeek?.transactionCount ?? '—' },
			{ Period: 'Last week', Amount: formatCurrency(data.lastWeek?.totalSales), Count: data.lastWeek?.transactionCount ?? '—' },
			{ Period: 'This month', Amount: formatCurrency(data.thisMonth?.totalSales), Count: data.thisMonth?.transactionCount ?? '—' },
			{ Period: 'Last month', Amount: formatCurrency(data.lastMonth?.totalSales), Count: data.lastMonth?.transactionCount ?? '—' }
		]
	};
}

export function mapTopProducts(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	const list = Array.isArray(data) ? data : [];
	const first = list[0];
	return {
		cards: first
			? [
					{ label: 'Best seller', value: String(first.product_name ?? '—'), color: '#10b981' },
					{ label: 'Units sold', value: String(first.units_sold ?? 0), color: '#6366f1' },
					{ label: 'Revenue', value: formatCurrency(first.total_revenue), color: '#f59e0b' }
				]
			: [],
		rows: list.map((it: any) => ({
			Product: it.product_name ?? '—',
			'Units sold': it.units_sold ?? 0,
			Revenue: formatCurrency(it.total_revenue)
		}))
	};
}

export function mapCustomersReport(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	if (!data) return { cards: [], rows: [] };
	const customers = Array.isArray(data.customers) ? data.customers : [];
	const top = customers[0];
	return {
		cards: [
			{ label: 'Customers', value: String(data.totalCustomers ?? 0), color: '#6366f1' },
			{ label: 'Total sales', value: formatCurrency(data.totalSales), color: '#10b981' },
			{ label: 'Top customer', value: String(top?.customer_name ?? '—'), color: '#f59e0b' }
		],
		rows: customers.map((c: any) => ({
			Customer: c.customer_name ?? '—',
			Orders: c.ordersCount ?? 0,
			Amount: formatCurrency(c.totalSales)
		}))
	};
}

export function mapStaffReport(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	const users = Array.isArray(data?.users) ? data.users : [];
	const totalSales = users.reduce((s: number, u: any) => s + Number(u.totalSales || 0), 0);
	const n = users.length || 1;
	const avg = totalSales / n;
	return {
		cards: [
			{ label: 'Total sales', value: formatCurrency(totalSales), color: '#10b981' },
			{ label: 'Active staff', value: String(users.length), color: '#6366f1' },
			{ label: 'Avg per staff', value: formatCurrency(avg), color: '#f59e0b' }
		],
		rows: users.map((u: any) => ({
			Staff: [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
			'Transactions': u.transactionsCount ?? 0,
			Amount: formatCurrency(u.totalSales),
			Period: data?.startDate && data?.endDate ? `${data.startDate} – ${data.endDate}` : '—'
		}))
	};
}

export function mapPurchasesSuppliers(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	if (!data) return { cards: [], rows: [] };
	const suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
	return {
		cards: [
			{ label: 'Purchases', value: formatCurrency(data.totalPurchases), color: '#f59e0b' },
			{ label: 'Invoices', value: String(data.purchaseCount ?? 0), color: '#6366f1' },
			{ label: 'Suppliers', value: String(data.supplierCount ?? suppliers.length), color: '#10b981' }
		],
		rows: suppliers.map((s: any) => ({
			Supplier: s.supplier_name ?? '—',
			'Purchase count': s.purchaseCount ?? 0,
			Amount: formatCurrency(s.totalPurchases),
			Period: data?.startDate && data?.endDate ? `${data.startDate} – ${data.endDate}` : '—'
		}))
	};
}

export function mapTransfers(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	if (!data) return { cards: [], rows: [] };
	const movements = Array.isArray(data.movements) ? data.movements : [];
	return {
		cards: [
			{ label: 'Transfers', value: String(data.transferCount ?? 0), color: '#6366f1' },
			{ label: 'Units moved', value: String(data.totalUnitsMoved ?? 0), color: '#10b981' }
		],
		rows: movements.map((m: any) => ({
			Date: m.created_at ? String(m.created_at).slice(0, 10) : '—',
			From: m.source_warehouse_name ?? '—',
			To: m.destination_warehouse_name ?? '—',
			Product: m.product_name ?? '—',
			Qty: m.quantity ?? 0
		}))
	};
}

export function mapAdjustments(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	if (!data) return { cards: [], rows: [] };
	const items = Array.isArray(data.items) ? data.items : [];
	return {
		cards: [
			{ label: 'Adjustments', value: String(data.adjustment_count ?? 0), color: '#6366f1' },
			{ label: 'Units adjusted', value: String(data.total_items_adjusted ?? data.total_items ?? 0), color: '#10b981' }
		],
		rows: items.map((it: any) => ({
			Date: it.created_at ? String(it.created_at).slice(0, 10) : '—',
			Product: it.product_name ?? '—',
			Type: it.adjustment_type ?? '—',
			Before: it.system_quantity ?? '—',
			After: it.quantity_adjusted ?? '—',
			Reason: it.reason ?? it.notes ?? '—'
		}))
	};
}

export function mapAuditLogs(data: any): { cards: ReportCard[]; rows: ReportRow[] } {
	const list = Array.isArray(data) ? data : [];
	const userIds = new Set(list.map((x: any) => x.user_id).filter(Boolean));
	return {
		cards: [
			{ label: 'Events', value: String(list.length), color: '#6366f1' },
			{ label: 'Users', value: String(userIds.size), color: '#10b981' }
		],
		rows: list.map((it: any) => ({
			Time: it.created_at ? String(it.created_at) : '—',
			User: [it.user_first_name, it.user_last_name].filter(Boolean).join(' ') || '—',
			Action: it.action ?? '—',
			Ref: it.ip_address ?? it.entity_id ?? '—'
		}))
	};
}
