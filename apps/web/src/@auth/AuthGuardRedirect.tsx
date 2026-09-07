'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
	getSessionRedirectUrl,
	resetSessionRedirectUrl,
	setSessionRedirectUrl
} from '@fuse/core/FuseAuthorization/sessionRedirectUrl';
import { FuseRouteObjectType } from '@fuse/core/FuseLayout/FuseLayout';
import usePathname from '@fuse/hooks/usePathname';
import FuseLoading from '@fuse/core/FuseLoading';
import useNavigate from '@fuse/hooks/useNavigate';
import useUser from './useUser';
import { hasPermissionCodes } from './permissions';

type AuthGuardProps = {
	auth: FuseRouteObjectType['auth'];
	children: React.ReactNode;
	loginRedirectUrl?: string;
};

function AuthGuardRedirect({ auth, children, loginRedirectUrl = '/' }: AuthGuardProps) {
	const { data: user, isGuest, subscriptionExpired, requiresPasswordReset } = useUser();
	const navigate = useNavigate();

	const [accessGranted, setAccessGranted] = useState<boolean>(false);
	const pathname = usePathname();

	/**
	 * While `requiresPasswordReset`, allow NextAuth + forgot + sign-out so users can recover (e.g. reset on another device: sign out, then sign in).
	 * Do not include `/sign-in` here — otherwise after login we stay on sign-in and never reach `/reset-password`.
	 */
	const requiresPasswordResetPublicPath =
		pathname.startsWith('/auth') ||
		pathname.startsWith('/forgot-password') ||
		pathname.startsWith('/sign-out') ||
		pathname.startsWith('/logout');

	// Function to handle redirection
	const handleRedirection = useCallback(() => {
		const sessionRedirectUrl = getSessionRedirectUrl();
		const merchantLinkedHome =
			Boolean((user as { merchant_id?: string | null })?.merchant_id) &&
			hasPermissionCodes(user, 'merchants.operate');
		const merchantPortalEligible = hasPermissionCodes(user, ['merchants.operate', 'merchants.view']);
		const defaultAfterLogin = merchantLinkedHome
			? '/merchants'
			: hasPermissionCodes(user, 'dashboard.view')
				? '/dashboards/analytics'
				: merchantPortalEligible
					? '/merchants'
					: '/';
		const redirectUrl =
			sessionRedirectUrl ||
			(loginRedirectUrl === '/' ? defaultAfterLogin : loginRedirectUrl);

		if (isGuest) {
			navigate('/sign-in');
		} else {
			navigate(redirectUrl);
			resetSessionRedirectUrl();
		}
	}, [isGuest, loginRedirectUrl, navigate, user]);

	// Check user's permissions and set access granted state
	useEffect(() => {
		if (requiresPasswordReset) {
			if (pathname.startsWith('/reset-password') || requiresPasswordResetPublicPath) {
				setAccessGranted(true);
				return;
			}
			navigate('/reset-password');
			setAccessGranted(false);
			return;
		}

		if (subscriptionExpired) {
			const onRenewalPath =
				pathname.startsWith('/apps/profile') || pathname.startsWith('/subscription');
			if (!onRenewalPath) {
				navigate('/apps/profile');
			}
			setAccessGranted(onRenewalPath);
			return;
		}

		const isOnlyGuestAllowed = Array.isArray(auth) && auth.length === 0;
		// Legacy role-based checks are intentionally removed; use guest/session flow only here.
		const userHasPermission = !isOnlyGuestAllowed;
		const ignoredPaths = ['/', '/callback', '/sign-in', '/sign-out', '/logout', '/404'];

		if (!auth || (auth && userHasPermission) || (isOnlyGuestAllowed && isGuest)) {
			resetSessionRedirectUrl();
			setAccessGranted(true);
			return;
		}

		if (!userHasPermission) {
			if (isGuest && !ignoredPaths.includes(pathname)) {
				setSessionRedirectUrl(pathname);
			} else if (!isGuest && !ignoredPaths.includes(pathname)) {
				/**
				 * If user is member but don't have permission to view the route
				 * redirected to main route '/'
				 */
				if (isOnlyGuestAllowed) {
					setSessionRedirectUrl('/');
				} else {
					setSessionRedirectUrl('/401');
				}
			}
		}

		handleRedirection();
	}, [auth, isGuest, pathname, subscriptionExpired, requiresPasswordReset, navigate]);

	// Return children if access is granted, otherwise null
	return accessGranted ? children : <FuseLoading />;
}

// the landing page "/" redirected to /example but the example npt

export default AuthGuardRedirect;
