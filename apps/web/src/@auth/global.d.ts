import { User } from '@auth/user';

declare module 'next-auth' {
	interface Session {
		accessToken?: string;
		db?: User;
		/** Set when tenant subscription is missing or not active (app access gated; profile/billing remain available). */
		subscriptionExpired?: boolean;
		subscriptionErrorCode?: string;
		subscriptionErrorMessage?: string;
		/** Set when `/api/users/me` indicates `reset_password`; client should send user to `/reset-password`. */
		requiresPasswordReset?: boolean;
	}
	interface JWT {
		accessToken?: string;
	}
}
