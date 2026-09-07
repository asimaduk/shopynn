import apiFetch from '@/utils/apiFetch';

/**
 * Login user
 */
export async function authLoginUser(user) {
	return apiFetch('/api/users/login', {
		method: 'POST',
		body: JSON.stringify(user)
	});
}

/**
 * Request password reset (forgot password). Sends email with reset link.
 */
export async function authForgotPassword(email: string) {
	return apiFetch('/api/users/forgot-password', {
		method: 'POST',
		body: JSON.stringify({ email: email.trim() })
	});
}

/**
 * Reset password when logged in. Body must include `password` (new) and `old_password` (current / temporary login password) — matches `POST /users/reset-password`.
 */
export async function authResetPassword(user, access_token) {
	return apiFetch('/api/users/reset-password', {
		method: 'POST',
		body: JSON.stringify(user),
		headers: {
			Authorization: `Bearer ${access_token}`
		}
	});
}

/**
 * Get user by email
 */
// export async function authGetDbUserByEmail(email: string): Promise<Response> {
// 	return apiFetch(`/api/mock/auth/user-by-email/${email}`);
// }

export async function authGetUserData(): Promise<Response> {
	return apiFetch(`/api/users/me`);
}

/**
 * Create user
 */
// export async function authCreateDbUser(user: PartialDeep<User>) {
// 	return apiFetch('/api/mock/users', {
// 		method: 'POST',
// 		body: JSON.stringify(UserModel(user))
// 	});
// }
