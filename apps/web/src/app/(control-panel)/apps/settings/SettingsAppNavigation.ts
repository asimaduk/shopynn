import { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';

/**
 * Settings sub-nav. Account / Security / Plan & Billing / Team were Fuse mocks;
 * those routes now redirect to profile / staff. Keep only real settings surfaces here.
 */
const SettingsAppNavigation: FuseNavItemType = {
	id: 'apps.settings',
	title: 'Settings',
	type: 'collapse',
	icon: 'heroicons-outline:cog-6-tooth',
	url: '/apps/settings',
	children: [
		{
			id: 'apps.settings.users',
			icon: 'heroicons-outline:users',
			title: 'Users',
			type: 'item',
			url: '/users/staff',
			subtitle: 'Create, edit, disable users and assign roles and permissions'
		},
		{
			id: 'apps.settings.receipt',
			icon: 'heroicons-outline:document-text',
			title: 'Invoice & Receipt',
			type: 'item',
			url: '/apps/settings/receipt-settings',
			requiredPermissions: ['receipt_settings.view', 'settings.view'],
			subtitle: 'Invoice/receipt details and thermal print agent'
		},
		{
			id: 'apps.settings.export',
			icon: 'heroicons-outline:arrow-down-tray',
			title: 'Export products',
			type: 'item',
			url: '/apps/settings/data-export',
			requiredPermissions: ['data_export.view'],
			featureFlag: 'dataExportBackup',
			subtitle: 'Download your product catalog as CSV'
		}
	]
};

export default SettingsAppNavigation;
