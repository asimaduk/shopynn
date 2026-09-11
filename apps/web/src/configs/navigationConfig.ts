import i18n from '@i18n';
import { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';
import en from './navigation-i18n/en';

i18n.addResourceBundle('en', 'navigation', en);

/**
 * Sidebar navigation – ordered for workflow-first UX:
 * Dashboards → Trading → Inventory → Expenses → Customers → Setups → Admin Tools
 */
const navigationConfig: FuseNavItemType[] = [
	{
		id: 'dashboards',
		title: 'Dashboard',
		subtitle: 'Overview & reports',
		type: 'group',
		icon: 'heroicons-outline:home',
		translate: 'DASHBOARD',
		children: [
			{
				id: 'dashboards.project',
				title: 'Overview',
				type: 'item',
				icon: 'heroicons-outline:clipboard-document-check',
				url: '/dashboards/analytics',
				requiredPermissions: ['dashboard.view'],
				requiredFeatures: ['dashboard.view']
			}
		]
	},
	{
		id: 'inventory',
		title: 'Inventory',
		subtitle: 'Items, categories, stock & transfers',
		type: 'group',
		icon: 'heroicons-outline:cube',
		// auth: authRoles.admin,
		children: [
			{
				id: 'inventory.products',
				title: 'Items',
				type: 'item',
				icon: 'heroicons-outline:circle-stack',
				url: '/inventory/products',
				requiredPermissions: ['inventory.view'],
				requiredFeatures: ['inventory.view']
			},
			{
				id: 'inventory.categories',
				title: 'Categories',
				type: 'item',
				icon: 'heroicons-outline:numbered-list',
				url: '/inventory/categories',
				requiredPermissions: ['categories.view'],
				requiredFeatures: ['categories.view']
			},
			{
				id: 'inventory.transactions',
				title: 'Transactions',
				type: 'item',
				icon: 'heroicons-outline:arrow-path',
				url: '/inventory/transactions',
				requiredPermissions: ['products.transactions.view'],
				requiredFeatures: ['products.transactions.view']
			},
			{
				id: 'inventory.transfers',
				title: 'Transfers',
				type: 'item',
				icon: 'heroicons-outline:arrows-right-left',
				url: '/inventory/transfers',
				requiredPermissions: ['transfers.view'],
				requiredFeatures: ['transfers.view']
			},
			{
				id: 'inventory.adjust.quantities',
				title: 'Adjustments (stock)',
				type: 'item',
				icon: 'heroicons-outline:adjustments-vertical',
				url: '/inventory/adjustquantities',
				requiredPermissions: ['adjustments.view'],
				requiredFeatures: ['adjustments.view']
			},
			{
				id: 'inventory.stock-count',
				title: 'Stock count / Audit',
				type: 'item',
				icon: 'heroicons-outline:clipboard-document-check',
				url: '/inventory/stock-count',
				requiredPermissions: ['stock_counts.view'],
				requiredFeatures: ['stock_counts.view']
			},
			{
				id: 'inventory.reorder',
				title: 'Reorder List',
				type: 'item',
				icon: 'heroicons-outline:exclamation-triangle',
				url: '/inventory/reorder',
				requiredPermissions: ['inventory.reorder.view'],
				requiredFeatures: ['inventory.reorder.view']
			},
			{
				id: 'inventory.expiring',
				title: 'Expiring List',
				type: 'item',
				icon: 'heroicons-outline:calendar-days',
				url: '/inventory/expiring',
				requiredPermissions: ['inventory.expiring.view'],
				requiredFeatures: ['inventory.expiring.view']
			}
		]
	},
	{
		id: 'trading',
		title: 'Trading',
		subtitle: 'Sales & purchases',
		type: 'group',
		icon: 'heroicons-outline:shopping-cart',
		children: [
			{
				id: 'trading.new-sale',
				title: 'New Sale',
				type: 'item',
				icon: 'heroicons-outline:plus-circle',
				url: '/trading/newsale',
				requiredPermissions: ['sales.create'],
				requiredFeatures: ['sales.create']
			},
			{
				id: 'trading.local-sales',
				title: 'Pending Sales',
				type: 'item',
				icon: 'heroicons-outline:clock',
				url: '/trading/pending',
				requiredPermissions: ['sales.pending.view'],
				requiredFeatures: ['sales.pending.view']
			},
			{
				id: 'trading.sales-list',
				title: 'Sales List',
				type: 'item',
				icon: 'heroicons-outline:queue-list',
				url: '/trading/sales',
				requiredPermissions: ['sales.view'],
				requiredFeatures: ['sales.view']
			},
			// {
			// 	id: 'trading.sales-returns',
			// 	title: 'Sales Returns',
			// 	type: 'item',
			// 	icon: 'heroicons-outline:arrow-uturn-left',
			// 	url: '/trading/sales/returns',
			// 	requiredPermissions: ['returns.view']
			// },
			{
				id: 'trading.new-purchase',
				title: 'New Purchase',
				type: 'item',
				icon: 'heroicons-outline:arrow-down-tray',
				url: '/trading/newpurchase',
				// auth: authRoles.admin,
				requiredPermissions: ['purchases.create'],
				requiredFeatures: ['purchases.create']
			},
			{
				id: 'trading.purchases-list',
				title: 'Purchases List',
				type: 'item',
				icon: 'heroicons-outline:rectangle-stack',
				url: '/trading/purchases',
				// auth: authRoles.admin,
				requiredPermissions: ['purchases.view'],
				requiredFeatures: ['purchases.view']
			},
			{
				id: 'trading.store-orders',
				title: 'Online Orders',
				type: 'item',
				icon: 'heroicons-outline:shopping-bag',
				url: '/trading/store-orders',
				requiredPermissions: ['orders.store.view'],
				requiredFeatures: ['orders.store.view']
			},
			{
				id: 'trading.order-payments',
				title: 'Order Payments',
				type: 'item',
				icon: 'heroicons-outline:banknotes',
				url: '/trading/order-payments',
				requiredPermissions: ['payments.view'],
				requiredFeatures: ['payments.view']
			},
			{
				id: 'trading.order-settlements',
				title: 'Order Settlements',
				type: 'item',
				icon: 'heroicons-outline:building-library',
				url: '/trading/order-settlements',
				requiredPermissions: ['payments.view'],
				requiredFeatures: ['payments.view']
			},
			// {
			// 	id: 'trading.purchases-returns',
			// 	title: 'Purchase Returns',
			// 	type: 'item',
			// 	icon: 'heroicons-outline:arrow-uturn-left',
			// 	url: '/trading/purchases/returns',
			// 	auth: authRoles.admin,
			// 	requiredPermissions: ['returns.view']
			// },
			// {
			// 	id: 'trading.purchase-orders',
			// 	title: 'Purchase Orders',
			// 	type: 'item',
			// 	icon: 'heroicons-outline:clipboard-document-list',
			// 	url: '/trading/purchase-orders',
			// 	auth: authRoles.admin,
			// 	requiredPermissions: ['purchase_orders.view', 'purchases.view'],
			// 	featureFlag: 'purchaseOrders'
			// }
		]
	},
	{
		id: 'expenses',
		title: 'Expenses',
		subtitle: 'Costs & expenditures',
		type: 'group',
		icon: 'heroicons-outline:banknotes',
		children: [
			{
				id: 'expenses.list',
				title: 'Expenses',
				type: 'item',
				icon: 'heroicons-outline:banknotes',
				url: '/expenses',
				requiredPermissions: ['expenses.view'],
				requiredFeatures: ['expenses.view']
			}
		]
	},
	{
		id: 'usage',
		title: 'User Management',
		subtitle: 'Customers & users',
		type: 'group',
		icon: 'heroicons-outline:user-group',
		children: [
			{
				id: 'usage.customers',
				title: 'Customers',
				type: 'item',
				icon: 'heroicons-outline:users',
				url: '/users/customers',
				requiredPermissions: ['customers.view'],
				requiredFeatures: ['customers.view']
			},
			{
				id: 'usage.users',
				title: 'Users',
				type: 'item',
				icon: 'heroicons-outline:user-circle',
				url: '/users/staff',
				requiredPermissions: ['users.view'],
				requiredFeatures: ['users.view']
			},
			{
				id: 'usage.suppliers',
				title: 'Suppliers',
				type: 'item',
				icon: 'heroicons-outline:rectangle-group',
				url: '/setups/suppliers',
				requiredPermissions: ['suppliers.view'],
				requiredFeatures: ['suppliers.view']
			}
		]
	},
	{
		id: 'setups',
		title: 'Setups',
		subtitle: 'Locations, stores / warehouses',
		type: 'group',
		icon: 'heroicons-outline:cog-6-tooth',
		// auth: authRoles.admin,
		children: [
			{
				id: 'setups.locations',
				title: 'Locations / Towns',
				type: 'item',
				icon: 'heroicons-outline:map-pin',
				url: '/setups/locations',
				requiredPermissions: ['locations.view'],
				requiredFeatures: ['locations.view']
			},
			{
				id: 'setups.stores',
				title: 'Stores / Branches',
				type: 'item',
				icon: 'heroicons-outline:building-storefront',
				url: '/setups/warehouses',
				requiredPermissions: ['warehouses.view'],
				requiredFeatures: ['stores.multi_access']
			}
		]
	},
	{
		id: 'adminTools',
		title: 'Admin Management',
		subtitle: 'System settings & administration',
		type: 'group',
		icon: 'heroicons-outline:wrench-screwdriver',
		// auth: authRoles.admin,
		children: [
			{
				id: 'adminTools.reports',
				title: 'Reports',
				type: 'item',
				icon: 'heroicons-outline:document-chart-bar',
				url: '/reports',
				requiredPermissions: ['reports.view'],
				requiredFeatures: ['reports.view']
			},
			{
				id: 'adminTools.notifications',
				title: 'Notifications',
				type: 'item',
				icon: 'heroicons-outline:bell',
				url: '/notifications',
				requiredPermissions: ['notifications.view'],
				requiredFeatures: ['notifications.view']
			},
			{
				id: 'adminTools.rolesPermissions',
				title: 'Roles & permissions',
				type: 'item',
				icon: 'heroicons-outline:shield-check',
				url: '/roles-permissions',
				requiredPermissions: ['roles.view', 'users.roles.view', 'users.view'],
				requiredFeatures: ['roles.view', 'users.roles.view', 'users.view']
			},
			{
				id: 'adminTools.invoiceReceipt',
				title: 'Invoice & Receipt',
				type: 'item',
				icon: 'heroicons-outline:document-text',
				url: '/apps/settings/receipt-settings',
				requiredPermissions: ['receipt_settings.view', 'settings.view']
			},
			{
				id: 'adminTools.merchants',
				title: 'Merchants',
				type: 'item',
				icon: 'heroicons-outline:building-office-2',
				url: '/merchants',
				requiredPermissions: ['merchants.view', 'merchants.operate'],
				requiredFeatures: ['merchants.operate']
			},
			{
				id: 'adminTools.tenantsDirectory',
				title: 'Tenants',
				type: 'item',
				icon: 'heroicons-outline:building-library',
				url: '/tenants-directory',
				// Withdrawals nest under this path; exact so both aren't active together.
				exact: true,
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			},
			{
				id: 'adminTools.withdrawalRequests',
				title: 'Withdrawal requests',
				type: 'item',
				icon: 'heroicons-outline:banknotes',
				url: '/tenants-directory/withdrawals',
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			},
			{
				id: 'adminTools.newsletterSubscribers',
				title: 'Newsletter subscribers',
				type: 'item',
				icon: 'heroicons-outline:envelope',
				url: '/marketing/newsletter-subscribers',
				requiredPermissions: ['newsletter.subscribers.view'],
				requiredFeatures: ['newsletter.subscribers.view']
			},
			{
				id: 'adminTools.newsletters',
				title: 'Newsletters',
				type: 'item',
				icon: 'heroicons-outline:newspaper',
				url: '/marketing/newsletters',
				requiredPermissions: ['newsletter.campaigns.view'],
				requiredFeatures: ['newsletter.campaigns.view']
			},
			{
				id: 'adminTools.broadcast',
				title: 'Broadcast',
				type: 'item',
				icon: 'heroicons-outline:megaphone',
				url: '/marketing/broadcast',
				requiredPermissions: ['tenants.directory.view', 'broadcasts.send'],
				requiredFeatures: ['tenants.directory.view', 'broadcasts.send']
			},
			{
				id: 'adminTools.contactRequests',
				title: 'Talk to us',
				type: 'item',
				icon: 'heroicons-outline:chat-bubble-left-right',
				url: '/marketing/contact-requests',
				requiredPermissions: ['contact_requests.view'],
				requiredFeatures: ['contact_requests.view']
			},
			{
				id: 'adminTools.siteChats',
				title: 'Live chat',
				type: 'item',
				icon: 'heroicons-outline:chat-bubble-oval-left-ellipsis',
				url: '/marketing/site-chats',
				requiredPermissions: ['site_chat.sessions.view'],
				requiredFeatures: ['site_chat.sessions.view']
			}
		]
	},
	{
		id: 'billingCatalog',
		title: 'Billing catalog',
		subtitle: 'Plans, prices & onboarding fees',
		type: 'group',
		icon: 'heroicons-outline:currency-dollar',
		requiredPermissions: ['tenants.directory.view'],
		requiredFeatures: ['tenants.directory.view'],
		children: [
			{
				id: 'billingCatalog.admin',
				title: 'Catalog',
				type: 'item',
				icon: 'heroicons-outline:currency-dollar',
				url: '/billing-catalog',
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			}
		]
	}
];

export default navigationConfig;
