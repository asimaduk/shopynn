import type { TourId } from './tourIds';

export type TourStepDef = {
	element?: string;
	title: string;
	description: string;
	/** Navigate here before highlighting (deep tours). */
	route?: string;
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
};

export type TourDefinition = {
	id: TourId;
	title: string;
	description: string;
	steps: TourStepDef[];
};

export const TOUR_CATALOG: TourDefinition[] = [
	{
		id: 'overview',
		title: 'Shopynn overview',
		description: 'A quick look at the main areas of the admin app.',
		steps: [
			{
				title: 'Welcome to Shopynn',
				description: 'This short tour shows where to sell, stock, buy, and check how the shop is doing. You can replay it anytime from your profile menu.'
			},
			{
				element: '[data-tour="nav-dashboards.project"]',
				title: 'Dashboard',
				description: 'Start here for today’s overview — sales, stock alerts, and how the shop is performing.',
				side: 'right'
			},
			{
				element: '[data-tour="nav-trading.new-sale"]',
				title: 'New Sale',
				description: 'Record walk-in sales here. Add items to the cart, take payment, and print or share a receipt.',
				side: 'right'
			},
			{
				element: '[data-tour="nav-inventory.products"]',
				title: 'Items',
				description: 'Your product catalogue lives here. Add items, set prices, and track stock levels.',
				side: 'right'
			},
			{
				element: '[data-tour="nav-trading.new-purchase"]',
				title: 'New Purchase',
				description: 'When stock arrives from a supplier, record it here so inventory stays accurate.',
				side: 'right'
			},
			{
				element: '[data-tour="nav-dashboards.reports"]',
				title: 'Reports',
				description: 'Sales, stock, and performance reports for the shop — filter by date and export when you need them.',
				side: 'right'
			},
			{
				element: '[data-tour="nav-setups.companyProfile"]',
				title: 'Company profile',
				description: 'Shop name, contact details, and branding used on receipts. Other setups (stores, suppliers, receipt layout) sit in this same menu.',
				side: 'right'
			}
		]
	},
	{
		id: 'inventory',
		title: 'Inventory',
		description: 'Find Items, add products, and keep stock in view.',
		steps: [
			{
				element: '[data-tour="nav-inventory.products"]',
				title: 'Open Items',
				description: 'Everything you sell is listed under Inventory → Items.',
				route: '/inventory/products',
				side: 'right'
			},
			{
				element: '[data-tour="inventory-items-header"]',
				title: 'Your catalogue',
				description: 'This page lists every product with quantity, price, and category. Search and filters help you find items quickly.',
				route: '/inventory/products',
				side: 'bottom'
			},
			{
				element: '[data-tour="inventory-add-item"]',
				title: 'Add an item',
				description: 'Use Add to create a product — name, price, stock, and optional barcode. You can also import in bulk later.',
				route: '/inventory/products',
				side: 'left'
			}
		]
	},
	{
		id: 'sales',
		title: 'Sales',
		description: 'Make a sale and find past receipts.',
		steps: [
			{
				element: '[data-tour="nav-trading.new-sale"]',
				title: 'New Sale',
				description: 'This is the point-of-sale screen for walk-in customers.',
				route: '/trading/newsale',
				side: 'right'
			},
			{
				element: '[data-tour="sales-product-search"]',
				title: 'Find products',
				description: 'Search or tap products to add them to the cart. Quantities and prices update as you go.',
				route: '/trading/newsale',
				side: 'bottom'
			},
			{
				element: '[data-tour="sales-cart"]',
				title: 'Cart and pay',
				description: 'The cart shows totals and discounts. Proceed opens payment — cash, MoMo, or other methods you use.',
				route: '/trading/newsale',
				side: 'left'
			},
			{
				element: '[data-tour="nav-trading.sales-list"]',
				title: 'Sales List',
				description: 'Past sales, receipts, and returns live under Sales List when you need to look something up.',
				side: 'right'
			}
		]
	},
	{
		id: 'purchases',
		title: 'Purchases',
		description: 'Record stock coming in from suppliers.',
		steps: [
			{
				element: '[data-tour="nav-trading.new-purchase"]',
				title: 'New Purchase',
				description: 'Use this whenever goods arrive so stock quantities stay correct.',
				route: '/trading/newpurchase',
				side: 'right'
			},
			{
				element: '[data-tour="purchases-shell"]',
				title: 'Record a purchase',
				description: 'Pick a supplier, add the items received with costs and quantities, then save. Stock updates automatically.',
				route: '/trading/newpurchase',
				side: 'bottom'
			},
			{
				element: '[data-tour="nav-trading.purchases-list"]',
				title: 'Purchases List',
				description: 'Open past purchase records here if you need to review or share them.',
				side: 'right'
			}
		]
	},
	{
		id: 'reports',
		title: 'Reports',
		description: 'See how the shop is doing.',
		steps: [
			{
				element: '[data-tour="nav-dashboards.reports"]',
				title: 'Reports menu',
				description: 'Reports are grouped by sales, stock, and other areas.',
				route: '/reports',
				side: 'right'
			},
			{
				element: '[data-tour="reports-page"]',
				title: 'Pick a report',
				description: 'Choose a report, set the date range, and open it. Many reports can be exported for your accountant.',
				route: '/reports',
				side: 'bottom'
			}
		]
	},
	{
		id: 'settings',
		title: 'Settings',
		description: 'Company profile, receipt layout, and team.',
		steps: [
			{
				element: '[data-tour="nav-setups.companyProfile"]',
				title: 'Company profile',
				description: 'Update the shop name, phone, and address shown on receipts and the storefront.',
				route: '/company-profile',
				side: 'right'
			},
			{
				element: '[data-tour="settings-company"]',
				title: 'Shop details',
				description: 'Keep these details accurate — customers and staff see them on invoices and the app.',
				route: '/company-profile',
				side: 'bottom'
			},
			{
				element: '[data-tour="nav-setups.invoiceReceipt"]',
				title: 'Receipt layout',
				description: 'Customize what prints on receipts. Team members are managed under Users when you are ready to add staff.',
				side: 'right'
			}
		]
	}
];

export function getTourDefinition(id: TourId): TourDefinition | undefined {
	return TOUR_CATALOG.find((t) => t.id === id);
}
