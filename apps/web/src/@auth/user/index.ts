import { FuseSettingsConfigType } from '@fuse/core/FuseSettings/FuseSettingsTypes';
import { PartialDeep } from 'type-fest';

/** Plan caps + usage from `/api/users/me` (`company.plan_usage` / `subscription.limits`). */
export type TenantPlanUsage = {
	maxUsers: number;
	maxWarehouses: number;
	maxLocations: number;
	userCount: number;
	warehouseCount: number;
	locationCount: number;
	tierCode?: string;
	tierDisplay?: string;
};

/**
 * The type definition for a user object.
 */
export type User = {
	id: string;
	role: string[] | string | null;
	/** Present when session is hydrated from /users/me — merchants row id for this user. */
	merchant_id?: string | null;
	permissions?: string[];
	displayName: string;
	photoURL?: string;
	email?: string;
	username?: string;
	staffId?: string;
	phone?: string;
	branch?: string;
	shortcuts?: string[];
	settings?: PartialDeep<FuseSettingsConfigType> & {
		permissions?: { code?: string }[];
		roles?: { name?: string }[];
		subscription?: { features?: string[] };
	};
	company?: {
		name?: string | null;
		address?: string | null;
		phone?: string | null;
		email?: string | null;
		organization?: string | null;
		industry?: string | null;
		industry_id?: string | null;
		logo?: string | null;
		plan_usage?: TenantPlanUsage;
		subscription?: {
			id?: string;
			name?: string;
			status?: string;
			amount?: number | null;
			billing_interval?: string | null;
			start_at?: string | null;
			end_at?: string | null;
			features?: string[];
			limits?: TenantPlanUsage;
		};
	};
	subscription?: {
		id?: string;
		name?: string;
		status?: string;
		start_at?: string | null;
		end_at?: string | null;
		features?: string[];
	};
	loginRedirectUrl?: string; // The URL to redirect to after login.
	isActive?: boolean;
	warehouse: {
		id?: string;
		name?: string;
	};
	resetPassword: boolean;
	passwordExpired?: boolean;
};
