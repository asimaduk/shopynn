'use client';

import authRoles from '@auth/authRoles';
import AuthGuardRedirect from '@auth/AuthGuardRedirect';
import ResetPasswordPage from './ResetPasswordPage';

function Page() {
	return (
		// <AuthGuardRedirect auth={authRoles.user}>
			<ResetPasswordPage />
		// </AuthGuardRedirect>
	);
}

export default Page;