/**
 * Inventory Management Dashboard Data
 * Static data for inventory dashboard widgets
 */

import type { RangeType } from './tabs/home/widgets/types/InventoryWidgetTypes';
import type {
	InventorySummaryWidgetType,
	LowStockWidgetType,
	InventoryValueWidgetType,
	TopProductsWidgetType,
	RecentTransactionsWidgetType,
	SalesSummaryWidgetType,
	StockMovementWidgetType,
	CategoryDistributionWidgetType
} from './tabs/home/widgets/types/InventoryWidgetTypes';

export type InventoryDashboardWidgets = {
	totalProducts?: InventorySummaryWidgetType;
	lowStock?: LowStockWidgetType;
	inventoryValue?: InventoryValueWidgetType;
	topProducts?: TopProductsWidgetType;
	recentTransactions?: RecentTransactionsWidgetType;
	salesSummary?: SalesSummaryWidgetType;
	stockMovements?: StockMovementWidgetType;
	categoryDistribution?: CategoryDistributionWidgetType;
};

const inventoryDashboardWidgets: InventoryDashboardWidgets = {
	totalProducts: {
		ranges: { DY: 'Today', DT: 'This Week', DTM: 'This Month' },
		currentRange: 'DTM',
		data: {
			name: 'Total Products',
			count: { DY: 1248, DT: 1248, DTM: 1248 },
			extra: { name: 'Active', count: { DY: 1180, DT: 1180, DTM: 1180 } }
		}
	},
	lowStock: {
		title: 'Low Stock Alert',
		data: {
			name: 'Products',
			count: 23,
			extra: { name: 'Critical', count: 8 }
		}
	},
	inventoryValue: {
		title: 'Inventory Value',
		data: {
			name: 'Total Value',
			value: 485000,
			extra: { name: 'This Month', value: 52000 }
		}
	},
	topProducts: {
		title: 'Top Selling Products',
		products: [
			{
				id: '1',
				name: 'Wireless Headphones',
				sales: 245,
				quantity: 245,
				revenue: 36750,
				image: 'https://i.pravatar.cc/150?u=product1'
			},
			{
				id: '2',
				name: 'Smart Watch',
				sales: 189,
				quantity: 189,
				revenue: 37800,
				image: 'https://i.pravatar.cc/150?u=product2'
			},
			{
				id: '3',
				name: 'USB-C Cable',
				sales: 456,
				quantity: 456,
				revenue: 9120,
				image: 'https://i.pravatar.cc/150?u=product3'
			},
			{
				id: '4',
				name: 'Laptop Stand',
				sales: 134,
				quantity: 134,
				revenue: 20100,
				image: 'https://i.pravatar.cc/150?u=product4'
			},
			{
				id: '5',
				name: 'Wireless Mouse',
				sales: 298,
				quantity: 298,
				revenue: 14900,
				image: 'https://i.pravatar.cc/150?u=product5'
			}
		]
	},
	recentTransactions: {
		title: 'Recent Transactions',
		transactions: [
			{
				id: '1',
				type: 'sale',
				product: 'Wireless Headphones',
				quantity: 5,
				amount: 750,
				date: '2026-02-20T10:30:00',
				warehouse: 'Main Warehouse'
			},
			{
				id: '2',
				type: 'purchase',
				product: 'Smart Watch',
				quantity: 20,
				amount: 4000,
				date: '2026-02-20T09:15:00',
				warehouse: 'Main Warehouse'
			},
			{
				id: '3',
				type: 'transfer',
				product: 'USB-C Cable',
				quantity: 50,
				amount: 0,
				date: '2026-02-19T16:45:00',
				warehouse: 'Store A'
			},
			{
				id: '4',
				type: 'sale',
				product: 'Laptop Stand',
				quantity: 3,
				amount: 450,
				date: '2026-02-19T14:20:00',
				warehouse: 'Store B'
			},
			{
				id: '5',
				type: 'adjustment',
				product: 'Wireless Mouse',
				quantity: -2,
				amount: 0,
				date: '2026-02-19T11:00:00',
				warehouse: 'Main Warehouse'
			}
		]
	},
	salesSummary: {
		ranges: { '7d': 'Last 7 days', '30d': 'Last 30 days' },
		labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		overview: {
			'7d': {
				totalSales: 124,
				totalRevenue: 18600,
				averageOrder: 150,
				transactions: 124
			},
			'30d': {
				totalSales: 542,
				totalRevenue: 81300,
				averageOrder: 150,
				transactions: 542
			}
		},
		series: {
			'7d': [
				{ name: 'Sales', type: 'line', data: [18, 22, 19, 25, 20, 15, 5] },
				{ name: 'Revenue', type: 'column', data: [2700, 3300, 2850, 3750, 3000, 2250, 750] }
			],
			'30d': [
				{ name: 'Sales', type: 'line', data: [78, 82, 75, 88, 85, 72, 62] },
				{ name: 'Revenue', type: 'column', data: [11700, 12300, 11250, 13200, 12750, 10800, 9300] }
			]
		}
	},
	stockMovements: {
		ranges: { '7d': 'Last 7 days', '30d': 'Last 30 days' },
		labels: ['Incoming', 'Outgoing', 'Transfers', 'Adjustments'],
		overview: {
			'7d': {
				incoming: 450,
				outgoing: 320,
				transfers: 85
			},
			'30d': {
				incoming: 1920,
				outgoing: 1450,
				transfers: 380
			}
		},
		series: {
			'7d': [450, 320, 85, 12],
			'30d': [1920, 1450, 380, 45]
		}
	},
	categoryDistribution: {
		categories: ['Electronics', 'Accessories', 'Computers', 'Mobile', 'Other'],
		series: [{ name: 'Products', data: [420, 380, 245, 180, 23] }]
	}
};

export default inventoryDashboardWidgets;
