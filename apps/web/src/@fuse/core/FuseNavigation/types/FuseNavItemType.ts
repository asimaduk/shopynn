import { SxProps } from '@mui/system';
import { FuseNavBadgeType } from './FuseNavBadgeType';
import { FeatureFlagKey } from 'src/configs/featureFlags';

/**
 * FuseNavItemType
 * A type for Fuse navigation item and its properties.
 */
export type FuseNavItemType = {
	id: string;
	title?: string;
	translate?: string;
	auth?: string[] | string;
	requiredPermissions?: string[] | string;
	requiredFeatures?: string[] | string;
	featureFlag?: FeatureFlagKey;
	subtitle?: string;
	icon?: string;
	iconClass?: string;
	url?: string;
	target?: string;
	type?: string;
	sx?: SxProps;
	disabled?: boolean;
	active?: boolean;
	exact?: boolean;
	end?: boolean;
	badge?: FuseNavBadgeType;
	children?: FuseNavItemType[];
	hasPermission?: boolean;
	/** Shown in nav but routes to upgrade — user has role permission, not plan feature. */
	lockedByPlan?: boolean;
};

export type FuseFlatNavItemType = Omit<FuseNavItemType, 'children' | 'sx'> & { children?: string[]; order: string };
