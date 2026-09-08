import NextAuth, { CredentialsSignin } from 'next-auth';
import { User } from '@auth/user';
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import vercelKVDriver from 'unstorage/drivers/vercel-kv';
import { UnstorageAdapter } from '@auth/unstorage-adapter';
// import type { NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
// import Facebook from 'next-auth/providers/facebook';
// import Google from 'next-auth/providers/google';
import { authGetUserData, authLoginUser } from './authApi';
import { setGlobalHeaders } from '@/utils/apiFetch';

function throwPasswordExpiredCredentials(): never {
	// Use base CredentialsSignin from `next-auth` (not a local subclass) so `instanceof AuthError`
	// matches inside Auth.js; otherwise the error is wrapped as CallbackRouteError → client sees "Configuration".
	const err = new CredentialsSignin('Password expired');
	err.code = 'password_expired';
	throw err;
}

/** Matches ims-services `requireActiveSubscription` 403 payloads — send user to `/subscription`. */
const SUBSCRIPTION_RENEWAL_CODES = new Set([
	'SUBSCRIPTION_EXPIRED',
	'SUBSCRIPTION_REQUIRED',
	'SUBSCRIPTION_NOT_STARTED',
	'SUBSCRIPTION_INACTIVE'
]);

type SubscriptionSnapshot = {
	id?: string | number | null;
	status?: string | null;
	start_at?: string | null;
	end_at?: string | null;
} | null | undefined;

/** Mirrors ims-services `requireActiveSubscription` — keep session `db` so profile/billing can load. */
function subscriptionRenewalFromMe(subscription: SubscriptionSnapshot): {
	expired: boolean;
	code?: string;
	message?: string;
} {
	if (!subscription?.id) {
		return { expired: true, code: 'SUBSCRIPTION_REQUIRED', message: 'No active subscription.' };
	}
	const status = String(subscription.status ?? '').toLowerCase();
	if (status !== 'active') {
		return { expired: true, code: 'SUBSCRIPTION_INACTIVE', message: 'Subscription is not active.' };
	}
	const now = new Date();
	if (subscription.start_at && new Date(subscription.start_at) > now) {
		return { expired: true, code: 'SUBSCRIPTION_NOT_STARTED', message: 'Subscription not yet active.' };
	}
	if (subscription.end_at && new Date(subscription.end_at) < now) {
		return { expired: true, code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription has expired.' };
	}
	return { expired: false };
}

const storage = createStorage({
	driver: process.env.VERCEL
		? vercelKVDriver({
				url: process.env.AUTH_KV_REST_API_URL,
				token: process.env.AUTH_KV_REST_API_TOKEN,
				env: false
			})
		: memoryDriver()
});

export const providers: Provider[] = [
	Credentials({
		async authorize(formInput) {
			const emailNormalized = String(formInput.email ?? '')
				.trim()
				.toLowerCase();

			const res = await authLoginUser({
				email: emailNormalized,
				password: String(formInput.password ?? '').trim()
			});

			const resJson = await res.json();
			console.log('resJson',resJson);
			if (resJson.data?.passwordExpired || resJson.data?.code === 'PASSWORD_EXPIRED') {
				throwPasswordExpiredCredentials();
			}

			if (resJson.status === 200 && resJson.data?.token) {
				return {
					id: emailNormalized,
					email: emailNormalized,
					token: resJson.data.token as string
				};
			}

			return null;
		}
	}),
	// Google,
	// Facebook
];

const config = {
	theme: { logo: '/assets/images/logo/shopynn-logo.png' },
	adapter: UnstorageAdapter(storage),
	pages: {
		signIn: '/sign-in'
	},
	providers,
	basePath: '/auth',
	trustHost: true,
	secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
	callbacks: {
		authorized() {
			/** Checkout information to how to use middleware for authorization
			 * https://next-auth.js.org/configuration/nextjs#middleware
			 */
			return true;
		},
		jwt({ token, trigger, account, user }) {			
			if (trigger === 'update') {
				token.name = user.name;
			}

			// if (account?.provider === 'keycloak') {
			// 	return { ...token, accessToken: account.access_token };
			// }
			if (account?.provider === 'credentials') {				
				return { ...token, accessToken: user.token, id: user.id };
			}

			return token;
		},
		async session({ session, token }) {			
			if (token.accessToken && typeof token.accessToken === 'string') {
				session.accessToken = token.accessToken;								
				setGlobalHeaders({'Authorization': `Bearer ${token.accessToken}`});
			}

			if (session) {
				try {
					const response = await authGetUserData();
					const payload = await response.json();
					// console.log('get user payload',payload);

					if (payload?.data?.reset_password) {
						return {
							...session,
							requiresPasswordReset: true,
							db: undefined
						};
					}
					
					if (response.status === 403 && SUBSCRIPTION_RENEWAL_CODES.has(String(payload?.code ?? ''))) {
						return {
							...session,
							subscriptionExpired: true,
							subscriptionErrorCode: String(payload?.code ?? '').toUpperCase(),
							subscriptionErrorMessage: String(payload?.error ?? payload?.message ?? 'Subscription access is required.'),
							db: undefined
						};
					}

					if (!response.ok) {
						return null;
					}

					const __data = payload?.data;

					if (__data) {
					const subscriptionFromApi = __data?.company?.subscription ?? null;
					const planUsageFromApi =
						__data?.company?.plan_usage ?? subscriptionFromApi?.limits ?? null;
					const subscriptionFeatures = Array.isArray(subscriptionFromApi?.features)
							? subscriptionFromApi.features.map((f) => String(f).trim().toLowerCase()).filter(Boolean)
							: [];
						delete session.subscriptionExpired;
						delete session.requiresPasswordReset;
						session.db = {
							displayName: `${__data.first_name} ${__data.last_name}`,
							email: __data.email,
							// id: __data.id,
							merchant_id: __data.merchant_id ?? null,
							isActive: __data.is_active,
							resetPassword: __data.reset_password,
							// role: __data.user_type === 1 ? 'admin':'staff',
							// permissions: Array.isArray(__data?.settings?.permissions)
							// 	? __data.settings.permissions.map((p) => p?.code).filter(Boolean)
							// 	: [],
							settings: {
								permissions: Array.isArray(__data?.settings?.permissions) ? __data.settings.permissions : [],
								roles: Array.isArray(__data?.settings?.roles) ? __data.settings.roles : [],
								subscription: {
									features: subscriptionFeatures
								}
							},
							company: __data?.company
								? {
									name: __data.company.name ?? null,
									address: __data.company.address ?? null,
									phone: __data.company.phone ?? null,
									email: __data.company.email ?? null,
									organization: __data.company.organization ?? null,
									industry: __data.company.industry ?? null,
									industry_id: __data.company.industry_id ?? null,
									logo: __data.company.logo ?? null,
									plan_usage: planUsageFromApi ?? undefined,
									subscription: subscriptionFromApi
										? {
											id: subscriptionFromApi.id,
											name: subscriptionFromApi.name,
											status: subscriptionFromApi.status,
											amount: subscriptionFromApi.amount ?? null,
											billing_interval: subscriptionFromApi.billing_interval ?? null,
											start_at: subscriptionFromApi.start_at,
											end_at: subscriptionFromApi.end_at,
											features: subscriptionFeatures,
											limits: subscriptionFromApi.limits ?? planUsageFromApi ?? undefined
										}
										: undefined
								}
								: undefined,
							subscription: subscriptionFromApi
								? {
									id: subscriptionFromApi.id,
									name: subscriptionFromApi.name,
									status: subscriptionFromApi.status,
									start_at: subscriptionFromApi.start_at,
									end_at: subscriptionFromApi.end_at,
									features: subscriptionFeatures
								}
								: undefined,
							warehouse: {
								id: __data.warehouse_id,
								name: __data.warehouse_name
							}
						} as User;

						session.user_id = __data.id;

						const renewal = subscriptionRenewalFromMe(subscriptionFromApi);
						if (renewal.expired) {
							return {
								...session,
								subscriptionExpired: true,
								subscriptionErrorCode: renewal.code,
								subscriptionErrorMessage: renewal.message
							};
						}

						// console.log('session',session);
						return session;
					}
					else {
						return null;
					}
				} catch (error) {
					// console.log('ERRRRRRR',error);
					
					// const errorStatus = (error as FetchApiError).status;

					/** If user not found, create a new user */
					// if (errorStatus === 404) {
					// 	const newUserResponse = await authCreateDbUser({
					// 		email: session.user.email,
					// 		role: ['admin'],
					// 		displayName: session.user.name,
					// 		photoURL: session.user.image
					// 	});

					// 	const newUser = (await newUserResponse.json()) as User;

					// 	console.error('Error fetching user data:', error);

					// 	session.db = newUser;

					// 	return session;
					// }

					throw error;
				}
			}

			return null;
		}
	},
	experimental: {
		enableWebAuthn: true
	},
	session: {
		strategy: 'jwt' as const,
		maxAge: 30 * 24 * 60 * 60 // 30 days
	},
	debug: process.env.NODE_ENV !== 'production'
} 
//satisfies NextAuthConfig;

export type AuthJsProvider = {
	id: string;
	name: string;
	style?: {
		text?: string;
		bg?: string;
	};
};

// export const authJsProviderMap: AuthJsProvider[] = providers
// 	.map((provider) => {
// 		const providerData = typeof provider === 'function' ? provider() : provider;

// 		return {
// 			id: providerData.id,
// 			name: providerData.name,
// 			style: {
// 				text: (providerData as { style?: { text: string } }).style?.text,
// 				bg: (providerData as { style?: { bg: string } }).style?.bg
// 			}
// 		};
// 	})
// 	.filter((provider) => provider.id !== 'credentials');

export const { handlers, auth, signIn, signOut } = NextAuth(config);
