import i18n from '@i18n';
import { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';
import en from './navigation-i18n/en';

i18n.addResourceBundle('en', 'navigation', en);

/**
 * Sidebar navigation – workflow-first for shop owners:
 * Dashboard → Trading → Inventory → People → Expenses → Setups → Admin → Platform
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
			},
			{
				id: 'dashboards.reports',
				title: 'Reports',
				type: 'item',
				icon: 'heroicons-outline:document-chart-bar',
				url: '/reports',
				requiredPermissions: ['reports.view'],
				requiredFeatures: ['reports.view']
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
				id: 'trading.pos-momo-payments',
				title: 'Pending MoMo',
				type: 'item',
				icon: 'heroicons-outline:device-phone-mobile',
				url: '/trading/pos-momo-payments',
				requiredPermissions: ['sales.create'],
				requiredFeatures: ['sales.create']
			},
			{
				id: 'trading.pos-sale-payments',
				title: 'POS MoMo payments',
				type: 'item',
				icon: 'heroicons-outline:banknotes',
				url: '/trading/pos-sale-payments',
				requiredPermissions: ['sales.view'],
				requiredFeatures: ['sales.view']
			},
			{
				id: 'trading.sales-list',
				title: 'Sales List',
				type: 'item',
				icon: 'heroicons-outline:queue-list',
				url: '/trading/sales',
				// exact so /trading/sales/returns does not also highlight Sales List
				exact: true,
				requiredPermissions: ['sales.view'],
				requiredFeatures: ['sales.view']
			},
			{
				id: 'trading.sales-returns',
				title: 'Sales Returns',
				type: 'item',
				icon: 'heroicons-outline:arrow-uturn-left',
				url: '/trading/sales/returns',
				requiredPermissions: ['returns.view'],
				requiredFeatures: ['returns.view']
			},
			{
				id: 'trading.new-purchase',
				title: 'New Purchase',
				type: 'item',
				icon: 'heroicons-outline:arrow-down-tray',
				url: '/trading/newpurchase',
				requiredPermissions: ['purchases.create'],
				requiredFeatures: ['purchases.create']
			},
			{
				id: 'trading.purchases-list',
				title: 'Purchases List',
				type: 'item',
				icon: 'heroicons-outline:rectangle-stack',
				url: '/trading/purchases',
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
			}
		]
	},
	{
		id: 'inventory',
		title: 'Inventory',
		subtitle: 'Items, stock & movements',
		type: 'group',
		icon: 'heroicons-outline:cube',
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
			},
			{
				id: 'inventory.transactions',
				title: 'Transactions',
				type: 'item',
				icon: 'heroicons-outline:arrow-path',
				url: '/inventory/transactions',
				requiredPermissions: ['products.transactions.view'],
				requiredFeatures: ['products.transactions.view']
			}
		]
	},
	{
		id: 'people',
		title: 'People',
		subtitle: 'Customers & staff',
		type: 'group',
		icon: 'heroicons-outline:user-group',
		children: [
			{
				id: 'people.customers',
				title: 'Customers',
				type: 'item',
				icon: 'heroicons-outline:users',
				url: '/users/customers',
				requiredPermissions: ['customers.view'],
				requiredFeatures: ['customers.view']
			},
			{
				id: 'people.users',
				title: 'Users',
				type: 'item',
				icon: 'heroicons-outline:user-circle',
				url: '/users/staff',
				requiredPermissions: ['users.view'],
				requiredFeatures: ['users.view']
			}
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
		id: 'setups',
		title: 'Setups',
		subtitle: 'Locations, stores & documents',
		type: 'group',
		icon: 'heroicons-outline:cog-6-tooth',
		children: [
			{
				id: 'setups.goLive',
				title: 'Go live checklist',
				type: 'item',
				icon: 'heroicons-outline:rocket-launch',
				url: '/setup/go-live'
			},
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
			},
			{
				id: 'setups.suppliers',
				title: 'Suppliers',
				type: 'item',
				icon: 'heroicons-outline:rectangle-group',
				url: '/setups/suppliers',
				requiredPermissions: ['suppliers.view'],
				requiredFeatures: ['suppliers.view']
			},
			{
				id: 'setups.invoiceReceipt',
				title: 'Invoice & Receipt',
				type: 'item',
				icon: 'heroicons-outline:document-text',
				url: '/apps/settings/receipt-settings',
				requiredPermissions: ['receipt_settings.view', 'settings.view']
			},
			{
				id: 'setups.dataExport',
				title: 'Export products',
				type: 'item',
				icon: 'heroicons-outline:arrow-down-tray',
				url: '/apps/settings/data-export',
				requiredPermissions: ['data_export.view'],
				requiredFeatures: ['data_export.view'],
				featureFlag: 'dataExportBackup'
			}
		]
	},
	{
		id: 'adminTools',
		title: 'Admin',
		subtitle: 'Roles & alerts',
		type: 'group',
		icon: 'heroicons-outline:wrench-screwdriver',
		children: [
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
				id: 'adminTools.notifications',
				title: 'Notifications',
				type: 'item',
				icon: 'heroicons-outline:bell',
				url: '/notifications',
				requiredPermissions: ['notifications.view'],
				requiredFeatures: ['notifications.view']
			}
		]
	},
	{
		id: 'platform',
		title: 'Platform',
		subtitle: 'Tenants, billing & marketing',
		type: 'group',
		icon: 'heroicons-outline:building-office-2',
		requiredPermissions: ['tenants.directory.view', 'merchants.view', 'merchants.operate', 'newsletter.subscribers.view', 'newsletter.campaigns.view', 'contact_requests.view', 'site_chat.sessions.view', 'broadcasts.send'],
		children: [
			{
				id: 'platform.merchants',
				title: 'Merchants',
				type: 'item',
				icon: 'heroicons-outline:building-office-2',
				url: '/merchants',
				requiredPermissions: ['merchants.view', 'merchants.operate'],
				requiredFeatures: ['merchants.operate']
			},
			{
				id: 'platform.tenantsDirectory',
				title: 'Tenants',
				type: 'item',
				icon: 'heroicons-outline:building-library',
				url: '/tenants-directory',
				exact: true,
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			},
			{
				id: 'platform.withdrawalRequests',
				title: 'Withdrawal requests',
				type: 'item',
				icon: 'heroicons-outline:banknotes',
				url: '/tenants-directory/withdrawals',
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			},
			{
				id: 'platform.platformMomoCharge',
				title: 'MoMo platform charge',
				type: 'item',
				icon: 'heroicons-outline:calculator',
				url: '/tenants-directory/payment-charge',
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			},
			{
				id: 'platform.mobileAppVersions',
				title: 'Mobile app versions',
				type: 'item',
				icon: 'heroicons-outline:device-phone-mobile',
				url: '/tenants-directory/mobile-app-versions',
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			},
			{
				id: 'platform.billingCatalog',
				title: 'Billing catalog',
				type: 'item',
				icon: 'heroicons-outline:currency-dollar',
				url: '/billing-catalog',
				requiredPermissions: ['tenants.directory.view'],
				requiredFeatures: ['tenants.directory.view']
			},
			{
				id: 'platform.newsletterSubscribers',
				title: 'Newsletter subscribers',
				type: 'item',
				icon: 'heroicons-outline:envelope',
				url: '/marketing/newsletter-subscribers',
				requiredPermissions: ['newsletter.subscribers.view'],
				requiredFeatures: ['newsletter.subscribers.view']
			},
			{
				id: 'platform.newsletters',
				title: 'Newsletters',
				type: 'item',
				icon: 'heroicons-outline:newspaper',
				url: '/marketing/newsletters',
				requiredPermissions: ['newsletter.campaigns.view'],
				requiredFeatures: ['newsletter.campaigns.view']
			},
			{
				id: 'platform.broadcast',
				title: 'Broadcast',
				type: 'item',
				icon: 'heroicons-outline:megaphone',
				url: '/marketing/broadcast',
				requiredPermissions: ['tenants.directory.view', 'broadcasts.send'],
				requiredFeatures: ['tenants.directory.view', 'broadcasts.send']
			},
			{
				id: 'platform.contactRequests',
				title: 'Talk to us',
				type: 'item',
				icon: 'heroicons-outline:chat-bubble-left-right',
				url: '/marketing/contact-requests',
				requiredPermissions: ['contact_requests.view'],
				requiredFeatures: ['contact_requests.view']
			},
			{
				id: 'platform.siteChats',
				title: 'Live chat',
				type: 'item',
				icon: 'heroicons-outline:chat-bubble-oval-left-ellipsis',
				url: '/marketing/site-chats',
				requiredPermissions: ['site_chat.sessions.view'],
				requiredFeatures: ['site_chat.sessions.view']
			}
		]
	}
];

export default navigationConfig;
