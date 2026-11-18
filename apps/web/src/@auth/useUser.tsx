import { useSession, signOut } from 'next-auth/react';
import { useMemo } from 'react';
import { User } from '@auth/user';
import { marketingSiteUrl, signInCallbackUrl } from '@/@auth/signOutUrl';
import apiFetch from '@/utils/apiFetch';

type useUser = {
	data: User | null;
	/** True when API reports subscription required / expired (see authJs session callback). */
	subscriptionExpired: boolean;
	/** True when API reports user must change password (`reset_password`). */
	requiresPasswordReset: boolean;
	isGuest: boolean;
	/** Shared Shopynn Demo Store session. */
	isDemo: boolean;
	// updateUser: (updates: Partial<User>) => Promise<User | undefined>;
	// updateUserSettings: (newSettings: User['settings']) => Promise<User['settings'] | undefined>;
	signOut: typeof signOut;
};

function useUser(): useUser {
	const { data } = useSession();
	const user = useMemo(() => data?.db, [data]);
	const subscriptionExpired = Boolean(data?.subscriptionExpired);
	const requiresPasswordReset = Boolean(data?.requiresPasswordReset);
	const isDemo = Boolean(user?.company?.settings?.demo);
	const isGuest = useMemo(() => {
		if (subscriptionExpired || requiresPasswordReset) {
			return false;
		}
		return !user?.settings?.roles?.[0]?.name || user?.settings?.roles?.length === 0;
	}, [user, subscriptionExpired, requiresPasswordReset]);

	/**
	 * Sign out — demo sessions return to the marketing site (cross-origin).
	 */
	async function handleSignOut() {
		// Ends this browser's session on the API too; local sign-out continues if it fails.
		if (data?.accessToken) {
			await apiFetch('/api/users/me/sessions/current', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${data.accessToken}` }
			}).catch(() => undefined);
		}
		if (isDemo) {
			await signOut({ redirect: false });
			window.location.assign(marketingSiteUrl('/'));
			return;
		}
		return signOut({ callbackUrl: signInCallbackUrl() });
	}

	return {
		data: user,
		subscriptionExpired,
		requiresPasswordReset,
		isGuest,
		isDemo,
		signOut: handleSignOut
	};
}

export default useUser;
