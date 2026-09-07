/**
 * Inventory dashboard widget types
 */

export type RangeType = 'DY' | 'DT' | 'DTM';

export type InventorySummaryWidgetType = {
	title?: string;
	ranges: Record<RangeType, string>;
	currentRange?: string;
	data: {
		name: string;
		count: Record<RangeType, number>;
		extra: { name: string; count: Record<RangeType, number> };
	};
};

export type LowStockWidgetType = {
	title?: string;
	data: {
		name: string;
		count: number;
		extra: { name: string; count: number };
	};
};

export type InventoryValueWidgetType = {
	title?: string;
	data: {
		name: string;
		value: number;
		extra: { name: string; value: number };
	};
};

export type TopProductType = {
	id: string;
	name: string;
	sales: number;
	quantity: number;
	revenue: number;
	image?: string;
};

export type TopProductsWidgetType = {
	title?: string;
	products: TopProductType[];
};

export type RecentTransactionType = {
	id: string;
	type: 'sale' | 'purchase' | 'transfer' | 'adjustment';
	product: string;
	quantity: number;
	amount: number;
	date: string;
	warehouse?: string;
};

export type RecentTransactionsWidgetType = {
	title?: string;
	transactions: RecentTransactionType[];
};

export type SalesSummaryWidgetType = {
	ranges: Record<string, string>;
	labels: string[];
	overview: Record<string, {
		totalSales: number;
		totalRevenue: number;
		averageOrder: number;
		transactions: number;
	}>;
	series: Record<string, {
		name: string;
		type: string;
		data: number[];
	}[]>;
};

export type StockMovementWidgetType = {
	ranges: Record<string, string>;
	labels: string[];
	overview: Record<string, {
		incoming: number;
		outgoing: number;
		transfers: number;
		adjustments?: number;
	}>;
	series: Record<string, number[]>;
};

export type CategoryDistributionWidgetType = {
	categories: string[];
	series: {
		name: string;
		data: number[];
	}[];
};
