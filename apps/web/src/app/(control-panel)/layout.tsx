import MainLayout from 'src/components/MainLayout';
import PermissionGate from '@auth/PermissionGate';

function Layout({ children }) {
	return (
		<PermissionGate
			requiredPermissions={[
				'dashboard.view',
				'sales.create',
				'sales.view',
				'purchases.create',
				'purchases.view',
				'inventory.view',
				'categories.view',
				'products.transactions.view',
				'transfers.view',
				'adjustments.view',
				'stock_counts.view',
				'expenses.view',
				'customers.view',
				'users.view',
				'suppliers.view',
				'locations.view',
				'warehouses.view',
				'reports.view',
				'notifications.view',
				'subscription.view',
				'roles.view',
				'settings.view',
				'merchants.operate',
				'merchants.view',
				'tenants.directory.view',
				'newsletter.subscribers.view',
				'newsletter.campaigns.view',
				'newsletter.campaigns.send',
				'contact_requests.view',
				'contact_requests.respond',
				'site_chat.sessions.view',
				'site_chat.sessions.respond'
			]}
			fallback={<></>}
		>
			<MainLayout>{children}</MainLayout>
		</PermissionGate>
	);
}

export default Layout;
