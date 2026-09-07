import { apiService as api } from 'src/store/apiService';

export const merchantTagTypes = ['merchant'] as const;

export type MerchantRecord = {
	id: string;
	user_id: string;
	default_commission_percent: string | number | null;
	created_at?: string;
	updated_at?: string;
};

export type AdminMerchantRow = MerchantRecord & {
	first_name?: string | null;
	last_name?: string | null;
	email?: string | null;
	phone?: string | null;
	onboarded_count?: number;
};

/** Tenant user without a merchants row (add-merchant picker). */
export type EligibleMerchantUserOption = {
	id: string;
	first_name?: string | null;
	last_name?: string | null;
	email?: string | null;
	phone?: string | null;
};

export type OnboardedTenantRow = {
	id: string;
	name: string | null;
	organization: string | null;
	phone: string | null;
	email: string | null;
	created_at: string | null;
	subscription_id?: string | null;
	subscription_name?: string | null;
	subscription_amount?: string | number | null;
	subscription_status?: string | null;
	subscription_end_at?: string | null;
	quote_id?: string | null;
	quote_status?: string | null;
	quote_total_ghs?: string | number | null;
};

export type MerchantCommissionRow = {
	id: string;
	merchant_id: string;
	tenant_id: string;
	subscription_id: string | null;
	base_amount: string | number;
	commission_percent: string | number;
	commission_amount: string | number;
	status: string;
	paid_at: string | null;
	notes: string | null;
	created_at: string;
	tenant_name?: string | null;
	tenant_organization?: string | null;
};

export type IndustryRow = {
	id: string;
	name: string;
	code?: string | null;
	description?: string | null;
	product_categorization?: string | number | null;
	created_at?: string;
	updated_at?: string;
};

export type OnboardingQuote = {
	id: string;
	tenant_id: string;
	status: string;
	total_ghs: number;
	owner_email?: string | null;
	lines?: { code: string; label: string; amount_ghs: number; line_type: string }[];
};

export type MerchantOnboardPayload = {
	name?: string;
	organization?: string;
	phone?: string;
	email?: string;
	notes?: string;
	address?: string;
	city?: string;
	state?: string;
	country?: string;
	postal_code?: string;
	website?: string;
	product_categorization?: number | null;
	industry_id?: string | null;
	subscription_type: number;
	addon_codes?: string[];
	first_name: string;
	last_name: string;
	owner_email: string;
	owner_phone?: string;
	password?: string;
	registration_method?: string;
};

export type MerchantOnboardResult = {
	tenant?: { id: string };
	quote?: OnboardingQuote;
	payment_required?: boolean;
};

const MerchantApi = api
	.enhanceEndpoints({ addTagTypes: merchantTagTypes })
	.injectEndpoints({
		endpoints: (build) => ({
			getMerchantMe: build.query<{ merchant: MerchantRecord | null }, void>({
				query: () => ({ url: '/api/merchants/me' }),
				providesTags: ['merchant']
			}),
			onboardBusiness: build.mutation<MerchantOnboardResult, MerchantOnboardPayload>({
				query: (body) => ({
					url: '/api/merchants/onboard',
					method: 'POST',
					body
				}),
				invalidatesTags: ['merchant']
			}),
			getTenantQuote: build.query<{ quote: OnboardingQuote | null }, string>({
				query: (tenantId) => ({ url: `/api/merchants/tenants/${tenantId}/quote` }),
				providesTags: ['merchant']
			}),
			createPayLaterQuote: build.mutation<
				{ quote: OnboardingQuote },
				{
					tenantId: string;
					addon_codes?: string[];
					owner_email?: string;
					quote_kind?: 'addon_only' | 'upgrade_collect';
					subscription_type?: number;
				}
			>({
				query: ({ tenantId, ...body }) => ({
					url: `/api/merchants/tenants/${tenantId}/quotes`,
					method: 'POST',
					body
				}),
				invalidatesTags: ['merchant']
			}),
			initiateTenantPayment: build.mutation<
				{
					redirect_url?: string;
					transaction_ref?: string;
					owner_email?: string;
					display_text?: string;
					quote?: OnboardingQuote;
				},
				{
					tenantId: string;
					payment_method: 'card' | 'mobile_money';
					phone?: string;
					provider?: string;
					email?: string;
				}
			>({
				query: ({ tenantId, ...body }) => ({
					url: `/api/merchants/tenants/${tenantId}/payments/initiate`,
					method: 'POST',
					body
				})
			}),
			submitTenantPaymentOtp: build.mutation<
				unknown,
				{ tenantId: string; reference: string; otp: string }
			>({
				query: ({ tenantId, reference, otp }) => ({
					url: `/api/merchants/tenants/${tenantId}/payments/submit-otp`,
					method: 'POST',
					body: { reference, otp }
				}),
				invalidatesTags: ['merchant']
			}),
			getOnboardedTenants: build.query<{ tenants: OnboardedTenantRow[] }, void>({
				query: () => ({ url: '/api/merchants/onboarded-tenants' }),
				providesTags: ['merchant']
			}),
			getMerchantCommissions: build.query<
				{ commissions: MerchantCommissionRow[] },
				{ status?: 'pending' | 'paid' } | undefined
			>({
				query: (arg) => ({
					url: '/api/merchants/commissions',
					params: arg && 'status' in arg && arg.status ? { status: arg.status } : undefined
				}),
				providesTags: ['merchant']
			}),
			promoteMerchant: build.mutation<
				unknown,
				| { user_id: string; default_commission_percent?: number | null }
				| {
						create_user: {
							first_name: string;
							last_name: string;
							email: string;
							phone: string;
						};
						default_commission_percent?: number | null;
				  }
			>({
				query: (body) => ({
					url: '/api/merchants/promote',
					method: 'POST',
					body
				}),
				invalidatesTags: ['merchant']
			}),
			getAdminMerchants: build.query<{ merchants: AdminMerchantRow[] }, void>({
				query: () => ({ url: '/api/merchants/admin/list' }),
				providesTags: ['merchant']
			}),
			getEligibleMerchantUsers: build.query<{ users: EligibleMerchantUserOption[] }, void>({
				query: () => ({ url: '/api/merchants/admin/eligible-users' }),
				providesTags: ['merchant']
			}),
			getAdminMerchantDetail: build.query<
				{ merchant: AdminMerchantRow; tenants: OnboardedTenantRow[]; commissions: MerchantCommissionRow[] },
				string
			>({
				query: (id) => ({ url: `/api/merchants/admin/${id}` }),
				providesTags: ['merchant']
			}),
			revokeMerchant: build.mutation<unknown, string>({
				query: (merchantId) => ({
					url: `/api/merchants/admin/${merchantId}`,
					method: 'DELETE'
				}),
				invalidatesTags: ['merchant']
			}),
			markCommissionPaid: build.mutation<unknown, string>({
				query: (id) => ({
					url: `/api/merchants/commissions/${id}/mark-paid`,
					method: 'PATCH'
				}),
				invalidatesTags: ['merchant']
			}),
			getIndustries: build.query<IndustryRow[], void>({
				query: () => ({ url: '/api/industries' })
			})
		}),
		overrideExisting: false
	});

export default MerchantApi;

export const {
	useGetMerchantMeQuery,
	useLazyGetMerchantMeQuery,
	useOnboardBusinessMutation,
	useGetOnboardedTenantsQuery,
	useGetMerchantCommissionsQuery,
	usePromoteMerchantMutation,
	useMarkCommissionPaidMutation,
	useGetAdminMerchantsQuery,
	useGetEligibleMerchantUsersQuery,
	useGetAdminMerchantDetailQuery,
	useRevokeMerchantMutation,
	useGetIndustriesQuery,
	useGetTenantQuoteQuery,
	useCreatePayLaterQuoteMutation,
	useInitiateTenantPaymentMutation,
	useSubmitTenantPaymentOtpMutation
} = MerchantApi;
