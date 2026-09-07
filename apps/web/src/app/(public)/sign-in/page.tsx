'use client';

import AuthGuardRedirect from '@auth/AuthGuardRedirect';
import SignInPage from './SignInPage';

function Page() {
	return (
		<AuthGuardRedirect auth={[]}>
			<SignInPage />
		</AuthGuardRedirect>
	);
}

export default Page;
