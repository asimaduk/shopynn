'use client';

import { Suspense } from 'react';
import authRoles from '@auth/authRoles';
import AuthGuardRedirect from '@auth/AuthGuardRedirect';
import ForgotPasswordPage from './ForgotPasswordPage';

export default function Page() {
	return (
		// <AuthGuardRedirect auth={authRoles.onlyGuest}>
			<Suspense fallback={null}>
				<ForgotPasswordPage />
			</Suspense>
		// </AuthGuardRedirect>
	);
}
