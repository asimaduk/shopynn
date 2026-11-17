/**
 * Mobile tour steps. `anchor` maps to TourAnchor ids.
 * `nav` drives rootNavigationRef before measuring.
 *   - { type: 'tab', screen: 'Dashboard' | 'Inventory' | ... }
 *   - { type: 'stack', screen: 'Customers' | 'NewSale' | ... }
 */

export const TOUR_CATALOG = [
    {
        id: 'overview',
        title: 'Shopynn overview',
        description: 'A quick look at the main areas of the app.',
        requiredPermissions: [
            'dashboard.view',
            'sales.view',
            'sales.create',
            'inventory.view',
            'products.view',
            'purchases.view',
            'purchases.create',
            'customers.view',
            'users.view',
            'reports.view',
            'company_profile.view',
            'settings.view',
        ],
        steps: [
            {
                title: 'Welcome to Shopynn',
                description:
                    'This short tour shows where to sell, stock, buy, manage customers and staff, and check how the shop is doing. Replay anytime from More → Take a tour.',
            },
            {
                anchor: 'tour-tab-dashboard',
                title: 'Dashboard',
                description: 'Start here for today’s overview — sales, stock alerts, and how the shop is performing.',
                nav: { type: 'tab', screen: 'Dashboard' },
                requiredPermissions: ['dashboard.view'],
            },
            {
                anchor: 'tour-tab-sales',
                title: 'Sales',
                description: 'Open Sales to record walk-in sales and review past receipts.',
                nav: { type: 'tab', screen: 'Sales' },
                requiredPermissions: ['sales.create', 'sales.view'],
            },
            {
                anchor: 'tour-tab-inventory',
                title: 'Inventory',
                description: 'Your product catalogue lives here. Add items, set prices, and track stock.',
                nav: { type: 'tab', screen: 'Inventory' },
                requiredPermissions: ['inventory.view', 'products.view'],
            },
            {
                anchor: 'tour-tab-purchases',
                title: 'Purchases',
                description: 'Record stock arriving from suppliers so inventory stays accurate.',
                nav: { type: 'tab', screen: 'Purchases' },
                requiredPermissions: ['purchases.create', 'purchases.view'],
            },
            {
                anchor: 'tour-tab-more',
                title: 'More',
                description: 'Customers, staff, reports, and setups live under More.',
                nav: { type: 'tab', screen: 'More' },
            },
            {
                anchor: 'tour-more-customers',
                title: 'Customers',
                description: 'More → Customers: your customer list for walk-in and credit sales.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['customers.view'],
            },
            {
                anchor: 'tour-more-users',
                title: 'Staff',
                description: 'More → Users: invite cashiers and managers and assign roles.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['users.view'],
            },
            {
                anchor: 'tour-more-reports',
                title: 'Reports',
                description: 'More → Reports: sales, stock, and performance reports.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['reports.view'],
            },
            {
                anchor: 'tour-more-company',
                title: 'Company profile',
                description: 'More → Company profile: shop name and details used on receipts.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['company_profile.view', 'settings.view'],
            },
        ],
    },
    {
        id: 'inventory',
        title: 'Inventory',
        description: 'Find Items, add products, and keep stock in view.',
        requiredPermissions: ['inventory.view', 'products.view'],
        steps: [
            {
                anchor: 'tour-tab-inventory',
                title: 'Open Inventory',
                description: 'Everything you sell is listed under the Inventory tab.',
                nav: { type: 'tab', screen: 'Inventory' },
                requiredPermissions: ['inventory.view', 'products.view'],
            },
            {
                anchor: 'tour-inventory-header',
                title: 'Your catalogue',
                description: 'Browse products with stock and price. Search and filters help you find items quickly.',
                nav: { type: 'tab', screen: 'Inventory' },
                requiredPermissions: ['inventory.view', 'products.view'],
            },
            {
                anchor: 'tour-inventory-add',
                title: 'Add an item',
                description: 'Tap + to create a product — name, price, stock, and optional barcode.',
                nav: { type: 'tab', screen: 'Inventory' },
                requiredPermissions: ['products.create'],
            },
        ],
    },
    {
        id: 'sales',
        title: 'Sales',
        description: 'Make a sale and find past receipts.',
        requiredPermissions: ['sales.view', 'sales.create'],
        steps: [
            {
                anchor: 'tour-tab-sales',
                title: 'Sales tab',
                description: 'Past sales live here. Use the cart button to start a new sale.',
                nav: { type: 'tab', screen: 'Sales' },
                requiredPermissions: ['sales.view', 'sales.create'],
            },
            {
                anchor: 'tour-sales-fab',
                title: 'New Sale',
                description: 'Tap this button to open the point-of-sale screen.',
                nav: { type: 'tab', screen: 'Sales' },
                requiredPermissions: ['sales.create'],
            },
            {
                anchor: 'tour-newsale-shell',
                title: 'Build the cart',
                description: 'Add products, pick a customer, then take payment — cash, MoMo, or other methods.',
                nav: { type: 'stack', screen: 'NewSale' },
                requiredPermissions: ['sales.create'],
            },
        ],
    },
    {
        id: 'purchases',
        title: 'Purchases',
        description: 'Record stock coming in from suppliers.',
        requiredPermissions: ['purchases.view', 'purchases.create'],
        steps: [
            {
                anchor: 'tour-tab-purchases',
                title: 'Purchases tab',
                description: 'Past purchases are listed here.',
                nav: { type: 'tab', screen: 'Purchases' },
                requiredPermissions: ['purchases.view', 'purchases.create'],
            },
            {
                anchor: 'tour-purchases-fab',
                title: 'New Purchase',
                description: 'Tap this whenever goods arrive so stock quantities stay correct.',
                nav: { type: 'tab', screen: 'Purchases' },
                requiredPermissions: ['purchases.create'],
            },
            {
                anchor: 'tour-newpurchase-shell',
                title: 'Record a purchase',
                description: 'Pick a supplier, add items with costs and quantities, then save.',
                nav: { type: 'stack', screen: 'NewPurchase' },
                requiredPermissions: ['purchases.create'],
            },
        ],
    },
    {
        id: 'customers',
        title: 'Customers',
        description: 'Keep your customer list and look people up at the till.',
        requiredPermissions: ['customers.view'],
        steps: [
            {
                anchor: 'tour-more-customers',
                title: 'Customers menu',
                description: 'Open More → Customers to manage everyone who buys from your shop.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['customers.view'],
            },
            {
                anchor: 'tour-customers-page',
                title: 'Customer list',
                description: 'Search existing customers or browse the list.',
                nav: { type: 'stack', screen: 'Customers' },
                requiredPermissions: ['customers.view'],
            },
            {
                anchor: 'tour-customers-add',
                title: 'Add a customer',
                description: 'Use + when someone new walks in — name and phone are enough to start.',
                nav: { type: 'stack', screen: 'Customers' },
                requiredPermissions: ['customers.create'],
            },
        ],
    },
    {
        id: 'staff',
        title: 'Staff',
        description: 'Add cashiers and managers, and control what they can do.',
        requiredPermissions: ['users.view'],
        steps: [
            {
                anchor: 'tour-more-users',
                title: 'Users / staff',
                description: 'Team accounts live under More → Users.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['users.view'],
            },
            {
                anchor: 'tour-staff-page',
                title: 'Your team',
                description: 'See who is active and open a person to change their role or details.',
                nav: { type: 'stack', screen: 'Users' },
                requiredPermissions: ['users.view'],
            },
            {
                anchor: 'tour-staff-add',
                title: 'Add staff',
                description: 'Invite a new user with +. Assign a role so they only see what they need.',
                nav: { type: 'stack', screen: 'Users' },
                requiredPermissions: ['users.create'],
            },
        ],
    },
    {
        id: 'reports',
        title: 'Reports',
        description: 'See how the shop is doing.',
        requiredPermissions: ['reports.view'],
        steps: [
            {
                anchor: 'tour-more-reports',
                title: 'Reports menu',
                description: 'Open More → Reports for sales, stock, and other analytics.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['reports.view'],
            },
            {
                anchor: 'tour-reports-page',
                title: 'Pick a report',
                description: 'Choose a report, set the date range, and open it.',
                nav: { type: 'stack', screen: 'Reports' },
                requiredPermissions: ['reports.view'],
            },
        ],
    },
    {
        id: 'settings',
        title: 'Settings',
        description: 'Company profile, receipt layout, and shop details.',
        requiredPermissions: ['company_profile.view', 'settings.view', 'receipt_settings.view'],
        steps: [
            {
                anchor: 'tour-more-company',
                title: 'Company profile',
                description: 'Update the shop name, phone, and address shown on receipts.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['company_profile.view', 'settings.view'],
            },
            {
                anchor: 'tour-company-page',
                title: 'Shop details',
                description: 'Keep these details accurate — customers and staff see them on invoices.',
                nav: { type: 'stack', screen: 'CompanyProfile' },
                requiredPermissions: ['company_profile.view', 'settings.view'],
            },
            {
                anchor: 'tour-more-receipt',
                title: 'Receipt layout',
                description: 'More → Invoice & Receipt customizes what prints on receipts.',
                nav: { type: 'tab', screen: 'More' },
                requiredPermissions: ['receipt_settings.view', 'settings.view'],
            },
        ],
    },
];

export function getTourDefinition(id) {
    return TOUR_CATALOG.find((t) => t.id === id);
}
