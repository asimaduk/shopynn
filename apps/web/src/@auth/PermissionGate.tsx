'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import usePathname from '@fuse/hooks/usePathname';
import useNavigate from '@fuse/hooks/useNavigate';
import FuseLoading from '@fuse/core/FuseLoading';
import useUser from './useUser';
import { evaluateFeatureAccess } from './permissions';
import { FeatureFlagKey } from 'src/configs/featureFlags';

type PermissionGateProps = {
	requiredPermissions?: string[] | string;
	requiredFeatures?: string[] | string;
	featureFlag?: FeatureFlagKey;
	/** @deprecated Use planFallback / permissionFallback for clearer UX */
	fallback?: React.ReactNode;
	planFallback?: React.ReactNode;
	permissionFallback?: React.ReactNode;
	children: React.ReactNode;
};

function PermissionGate({
	requiredPermissions,
	requiredFeatures,
	featureFlag,
	fallback = null,
	planFallback,
	permissionFallback,
	children
}: PermissionGateProps) {
	const pathname = usePathname();
	const navigate = useNavigate();
	const { status } = useSession();
	const { data: user } = useUser();

	useEffect(() => {
		if (status !== 'unauthenticated') return;
		if (pathname.startsWith('/apps/profile') || pathname.startsWith('/subscription') || pathname.startsWith('/reset-password')) return;
		navigate('/sign-in');
	}, [status, pathname, navigate]);

	if (
		pathname.startsWith('/apps/profile') ||
		pathname.startsWith('/subscription') ||
		pathname.startsWith('/reset-password') ||
		pathname.startsWith('/upgrade')
	) {
		return <>{children}</>;
	}

	if (status === 'loading') {
		return <FuseLoading />;
	}

	if (status === 'unauthenticated') {
		return <FuseLoading />;
	}

	const access = evaluateFeatureAccess(user, requiredPermissions, featureFlag, requiredFeatures);
	if (access.allowed) return <>{children}</>;

	if (fallback != null) return <>{fallback}</>;
	if (access.deniedBy === 'plan') return <>{planFallback ?? fallback}</>;
	if (access.deniedBy === 'permission') return <>{permissionFallback ?? fallback}</>;
	return <>{fallback}</>;
}

export default PermissionGate;
