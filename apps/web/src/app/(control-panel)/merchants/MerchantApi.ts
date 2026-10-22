import { apiService as api } from 'src/store/apiService';

export const merchantTagTypes = ['merchant'] as const;

export type AgentType = 'agent' | 'manager';
export type AgentStatus = 'pending_approval' | 'active' | 'rejected' | 'deactivated';

export type MerchantRecord = {
	id: string;
	user_id: string;
	default_commission_percent: string | number | null;
	agent_type?: AgentType;
	manager_id?: string | null;
	status?: AgentStatus;
	created_at?: string;
	updated_at?: string;
};

export type AdminMerchantRow = MerchantRecord & {
	first_name?: string | null;
	last_name?: string | null;
	email?: string | null;
	phone?: string | null;
	onboarded_count?: number;
	serving_count?: number;
	awaiting_payment_count?: number;
	team_size?: number;
	status_reason?: string | null;
	manager_first_name?: string | null;
	manager_last_name?: string | null;
	recruited_by?: string | null;
	recruited_by_first_name?: string | null;
	recruited_by_last_name?: string | null;
	approved_at?: string | null;
	deactivated_at?: string | null;
};

export type TeamMemberRow = AdminMerchantRow & {
	pending_commission_ghs?: string | number;
	paid_commission_ghs?: string | number;
};

export type DeactivateAgentResult = {
	id: string;
	status: AgentStatus;
	handed_to: string | null;
	shops_moved: number;
	unchanged?: boolean;
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
	serving_merchant_id?: string | null;
	onboarded_by_merchant_id?: string | null;
	agent_merchant_id?: string | null;
	awaiting_first_payment?: boolean;
	is_serving_agent?: boolean;
	agent_first_name?: string | null;
	agent_last_name?: string | null;
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
	commission_kind?: 'acquisition' | 'residual' | 'override';
	payable_after?: string | null;
	payout_id?: string | null;
	cancel_reason?: string | null;
	lifecycle?: CommissionLifecycle;
	source_agent_first_name?: string | null;
	source_agent_last_name?: string | null;
};

export type CommissionLifecycle = 'held' | 'payable' | 'in_payout' | 'paid' | 'cancelled';

export type PayoutStatus = 'pending_approval' | 'processing' | 'paid' | 'failed' | 'rejected';

export type MomoNetwork = 'mtn' | 'vodafone' | 'airteltigo';

export type AgentPayoutProfile = {
	merchant_id: string;
	payout_method: 'momo';
	momo_network: MomoNetwork;
	momo_number: string;
	account_holder_name: string;
	updated_at?: string;
};

export type AgentPayoutRow = {
	id: string;
	merchant_id?: string;
	amount: string | number;
	fee_absorbed?: string | number;
	status: PayoutStatus;
	commission_count: number;
	failure_reason?: string | null;
	payout_snapshot?: { momo_network?: string; momo_number?: string; account_holder_name?: string } | null;
	payout_channel?: string | null;
	paystack_transfer_reference?: string | null;
	attempts?: number;
	created_at: string;
	approved_at?: string | null;
	paid_at?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	email?: string | null;
	phone?: string | null;
	agent_type?: AgentType;
};

export type AgentEarnings = {
	held_ghs: string | number;
	payable_ghs: string | number;
	in_payout_ghs: string | number;
	paid_ghs: string | number;
	next_release_at: string | null;
	payout_min_ghs: number;
	payout_schedule: string;
	payouts: AgentPayoutRow[];
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
				(
					| { user_id: string }
					| {
							create_user: {
								first_name: string;
								last_name: string;
								email: string;
								phone: string;
							};
					  }
				) & {
					default_commission_percent?: number | null;
					agent_type?: AgentType;
					manager_id?: string | null;
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
				{
					merchant: AdminMerchantRow;
					tenants: OnboardedTenantRow[];
					commissions: MerchantCommissionRow[];
					team: TeamMemberRow[];
				},
				string
			>({
				query: (id) => ({ url: `/api/merchants/admin/${id}` }),
				providesTags: ['merchant']
			}),
			deactivateMerchant: build.mutation<DeactivateAgentResult, { merchantId: string; reason?: string }>({
				query: ({ merchantId, reason }) => ({
					url: `/api/merchants/admin/${merchantId}/deactivate`,
					method: 'POST',
					body: { reason }
				}),
				invalidatesTags: ['merchant']
			}),
			reactivateMerchant: build.mutation<unknown, string>({
				query: (merchantId) => ({
					url: `/api/merchants/admin/${merchantId}/reactivate`,
					method: 'POST'
				}),
				invalidatesTags: ['merchant']
			}),
			updateMerchantAdmin: build.mutation<
				unknown,
				{ merchantId: string; agent_type?: AgentType; manager_id?: string | null }
			>({
				query: ({ merchantId, ...body }) => ({
					url: `/api/merchants/admin/${merchantId}`,
					method: 'PATCH',
					body
				}),
				invalidatesTags: ['merchant']
			}),
			approveRecruit: build.mutation<unknown, string>({
				query: (merchantId) => ({
					url: `/api/merchants/admin/${merchantId}/approve`,
					method: 'POST'
				}),
				invalidatesTags: ['merchant']
			}),
			rejectRecruit: build.mutation<unknown, { merchantId: string; reason?: string }>({
				query: ({ merchantId, reason }) => ({
					url: `/api/merchants/admin/${merchantId}/reject`,
					method: 'POST',
					body: { reason }
				}),
				invalidatesTags: ['merchant']
			}),
			getMyTeam: build.query<{ members: TeamMemberRow[] }, void>({
				query: () => ({ url: '/api/merchants/team' }),
				providesTags: ['merchant']
			}),
			getMyTeamTenants: build.query<{ tenants: OnboardedTenantRow[] }, void>({
				query: () => ({ url: '/api/merchants/team/tenants' }),
				providesTags: ['merchant']
			}),
			recruitTeamAgent: build.mutation<
				unknown,
				{ first_name: string; last_name: string; email: string; phone: string }
			>({
				query: (body) => ({
					url: '/api/merchants/team/recruit',
					method: 'POST',
					body
				}),
				invalidatesTags: ['merchant']
			}),
			reassignTeamTenant: build.mutation<unknown, { tenantId: string; merchant_id: string; reason?: string }>({
				query: ({ tenantId, ...body }) => ({
					url: `/api/merchants/team/tenants/${tenantId}/serving`,
					method: 'PUT',
					body
				}),
				invalidatesTags: ['merchant']
			}),
			deactivateTeamAgent: build.mutation<DeactivateAgentResult, { merchantId: string; reason?: string }>({
				query: ({ merchantId, reason }) => ({
					url: `/api/merchants/team/${merchantId}/deactivate`,
					method: 'POST',
					body: { reason }
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
			getMyEarnings: build.query<{ earnings: AgentEarnings; payout_profile: AgentPayoutProfile | null }, void>({
				query: () => ({ url: '/api/merchants/earnings' }),
				providesTags: ['merchant']
			}),
			savePayoutProfile: build.mutation<
				{ payout_profile: AgentPayoutProfile },
				{ momo_network: MomoNetwork; momo_number: string; account_holder_name: string }
			>({
				query: (body) => ({ url: '/api/merchants/payout-profile', method: 'PUT', body }),
				invalidatesTags: ['merchant']
			}),
			getAgentPayouts: build.query<
				{ payouts: AgentPayoutRow[]; live_transfers_blocked: boolean },
				{ status?: PayoutStatus } | void
			>({
				query: (arg) => ({
					url: '/api/merchants/admin/payouts',
					params: arg && arg.status ? { status: arg.status } : undefined
				}),
				providesTags: ['merchant']
			}),
			prepareAgentPayouts: build.mutation<
				{
					created: { id: string; name: string; amount: number }[];
					skipped_no_profile: { merchant_id: string; name: string; payable_ghs: string }[];
					min_ghs: number;
				},
				void
			>({
				query: () => ({ url: '/api/merchants/admin/payouts/prepare', method: 'POST' }),
				invalidatesTags: ['merchant']
			}),
			approveAgentPayout: build.mutation<{ payout: AgentPayoutRow }, string>({
				query: (id) => ({ url: `/api/merchants/admin/payouts/${id}/approve`, method: 'POST' }),
				invalidatesTags: ['merchant']
			}),
			rejectAgentPayout: build.mutation<unknown, { id: string; reason?: string }>({
				query: ({ id, reason }) => ({
					url: `/api/merchants/admin/payouts/${id}/reject`,
					method: 'POST',
					body: { reason }
				}),
				invalidatesTags: ['merchant']
			}),
			markAgentPayoutFailed: build.mutation<unknown, { id: string; reason?: string }>({
				query: ({ id, reason }) => ({
					url: `/api/merchants/admin/payouts/${id}/mark-failed`,
					method: 'POST',
					body: { reason }
				}),
				invalidatesTags: ['merchant']
			}),
			cancelCommission: build.mutation<unknown, { id: string; reason?: string }>({
				query: ({ id, reason }) => ({
					url: `/api/merchants/admin/commissions/${id}/cancel`,
					method: 'POST',
					body: { reason }
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
	useGetMyEarningsQuery,
	useSavePayoutProfileMutation,
	useGetAgentPayoutsQuery,
	usePrepareAgentPayoutsMutation,
	useApproveAgentPayoutMutation,
	useRejectAgentPayoutMutation,
	useMarkAgentPayoutFailedMutation,
	useCancelCommissionMutation,
	useDeactivateMerchantMutation,
	useReactivateMerchantMutation,
	useUpdateMerchantAdminMutation,
	useApproveRecruitMutation,
	useRejectRecruitMutation,
	useGetMyTeamQuery,
	useGetMyTeamTenantsQuery,
	useRecruitTeamAgentMutation,
	useReassignTeamTenantMutation,
	useDeactivateTeamAgentMutation,
	useGetIndustriesQuery,
	useGetTenantQuoteQuery,
	useCreatePayLaterQuoteMutation,
	useInitiateTenantPaymentMutation,
	useSubmitTenantPaymentOtpMutation
} = MerchantApi;
