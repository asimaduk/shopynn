import { useSession, signOut } from 'next-auth/react';
import { useMemo } from 'react';
import { User } from '@auth/user';

type useUser = {
	data: User | null;
	/** True when API reports subscription required / expired (see authJs session callback). */
	subscriptionExpired: boolean;
	/** True when API reports user must change password (`reset_password`). */
	requiresPasswordReset: boolean;
	isGuest: boolean;
	// updateUser: (updates: Partial<User>) => Promise<User | undefined>;
	// updateUserSettings: (newSettings: User['settings']) => Promise<User['settings'] | undefined>;
	signOut: typeof signOut;
};

function useUser(): useUser {
	const { data } = useSession();
	const user = useMemo(() => data?.db, [data]);
	const subscriptionExpired = Boolean(data?.subscriptionExpired);
	const requiresPasswordReset = Boolean(data?.requiresPasswordReset);
	const isGuest = useMemo(() => {
		if (subscriptionExpired || requiresPasswordReset) {
			return false;
		}
		return !user?.settings?.roles?.[0]?.name || user?.settings?.roles?.length === 0;
	}, [user, subscriptionExpired, requiresPasswordReset]);

	/**
	 * Sign out
	 */
	async function handleSignOut() {
		return signOut({ callbackUrl: '/sign-in' });
	}

	return {
		data: user,
		subscriptionExpired,
		requiresPasswordReset,
		isGuest,
		signOut: handleSignOut
	};
}

export default useUser;
