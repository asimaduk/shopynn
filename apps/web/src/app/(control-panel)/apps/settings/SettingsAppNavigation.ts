import { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';

const SettingsAppNavigation: FuseNavItemType = {
	id: 'apps.settings',
	title: 'Settings',
	type: 'collapse',
	icon: 'heroicons-outline:cog-6-tooth',
	url: '/apps/settings',
	children: [
		{
			id: 'apps.settings.account',
			icon: 'heroicons-outline:user-circle',
			title: 'Account',
			type: 'item',
			url: '/apps/settings/account',
			subtitle: 'Manage your public profile and private information'
		},
		{
			id: 'apps.settings.security',
			icon: 'heroicons-outline:lock-closed',
			title: 'Security',
			type: 'item',
			url: '/apps/settings/security',
			subtitle: 'Manage your password and 2-step verification preferences'
		},
		{
			id: 'apps.settings.planBilling',
			icon: 'heroicons-outline:credit-card',
			title: 'Plan & Billing',
			type: 'item',
			url: '/apps/settings/plan-billing',
			subtitle: 'Manage your subscription plan, payment method and billing information'
		},
		{
			id: 'apps.settings.team',
			icon: 'heroicons-outline:user-group',
			title: 'Team',
			type: 'item',
			url: '/apps/settings/team',
			subtitle: 'Manage your existing team and change roles/permissions'
		},
		{
			id: 'apps.settings.users',
			icon: 'heroicons-outline:users',
			title: 'Users',
			type: 'item',
			url: '/apps/settings/users',
			subtitle: 'Create, edit, disable users and assign roles and permissions'
		},
		{
			id: 'apps.settings.receipt',
			icon: 'heroicons-outline:document-text',
			title: 'Receipt Settings',
			type: 'item',
			url: '/apps/settings/receipt-settings',
			requiredPermissions: ['receipt_settings.view'],
			featureFlag: 'receiptSettings',
			subtitle: 'Configure invoice and receipt details'
		},
		{
			id: 'apps.settings.export',
			icon: 'heroicons-outline:arrow-down-tray',
			title: 'Data Export & Backup',
			type: 'item',
			url: '/apps/settings/data-export',
			requiredPermissions: ['data_export.view'],
			featureFlag: 'dataExportBackup',
			subtitle: 'Export and backup business data'
		},
	]
};

export default SettingsAppNavigation;
