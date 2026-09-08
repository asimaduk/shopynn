import { apiService as api } from 'src/store/apiService';

export const tenantsDirectoryTagTypes = ['tenantsDirectory'] as const;

export type TenantDirectoryRow = {
	id: string;
	name: string | null;
	organization: string | null;
	phone: string | null;
	email: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	address: string | null;
	/** Users in this tenant who have a merchants row (partners registered on the same business). */
	merchant_count?: number;
	subscription_id: string | null;
	created_at?: string;
	updated_at?: string;
	subscription_name?: string | null;
	subscription_status?: string | null;
	subscription_amount?: string | number | null;
	subscription_start_at?: string | null;
	subscription_end_at?: string | null;
	industry_name?: string | null;
	user_count?: number;
	warehouse_count?: number;
};

export type TenantDirectoryDetailPayment = {
	id: string;
	amount: number | null;
	payment_method_type: string | null;
	transaction_ref: string | null;
	status: string | null;
	created_at: string | null;
};

export type TenantDirectoryDetail = {
	tenant: TenantDirectoryRow & Record<string, unknown>;
	subscription: {
		id: string;
		name: string | null;
		description: string | null;
		amount: number | null;
		billing_interval: string | null;
		status: string | null;
		start_at: string | null;
		end_at: string | null;
		features: string | null;
		created_at: string | null;
		updated_at: string | null;
	} | null;
	recentPayments: TenantDirectoryDetailPayment[];
	serving_merchant?: {
		id: string;
		first_name?: string | null;
		last_name?: string | null;
		email?: string | null;
		phone?: string | null;
	} | null;
	assignment_history?: {
		id: string;
		merchant_id: string | null;
		previous_merchant_id: string | null;
		reason: string | null;
		created_at: string;
		merchant_first_name?: string | null;
		merchant_last_name?: string | null;
		merchant_email?: string | null;
	}[];
};

const TenantsDirectoryApi = api
	.enhanceEndpoints({ addTagTypes: tenantsDirectoryTagTypes })
	.injectEndpoints({
		endpoints: (build) => ({
			getTenantsDirectoryList: build.query<{ tenants: TenantDirectoryRow[] }, { q?: string } | void>({
				query: (arg) => ({
					url: '/api/tenants/admin/list',
					params: arg && typeof arg === 'object' && arg.q ? { q: arg.q } : undefined
				}),
				providesTags: ['tenantsDirectory']
			}),
			getTenantDirectoryDetail: build.query<TenantDirectoryDetail, string>({
				query: (id) => ({ url: `/api/tenants/admin/${id}` }),
				providesTags: ['tenantsDirectory']
			}),
			getAdminTenantSettlementSummary: build.query<
				{
					digital_collected: number;
					settled_paid: number;
					pending_settlements: number;
					available_balance: number;
					currency: string;
				},
				string
			>({
				query: (tenantId) => ({ url: `/api/tenants/admin/${tenantId}/settlements/summary` })
			}),
			getAdminTenantSettlements: build.query<any[], string>({
				query: (tenantId) => ({ url: `/api/tenants/admin/${tenantId}/settlements` }),
				transformResponse: (raw: any) => (Array.isArray(raw) ? raw : raw?.items ?? raw?.list ?? raw?.data ?? [])
			}),
			createAdminTenantSettlement: build.mutation<any, { tenantId: string; amount: number; note?: string }>({
				query: ({ tenantId, ...body }) => ({
					url: `/api/tenants/admin/${tenantId}/settlements`,
					method: 'POST',
					body
				}),
				invalidatesTags: ['tenantsDirectory']
			}),
			markAdminSettlementPaid: build.mutation<any, { id: string; payout_reference?: string; note?: string }>({
				query: ({ id, ...body }) => ({
					url: `/api/tenants/admin/settlements/${id}/mark-paid`,
					method: 'PATCH',
					body
				}),
				invalidatesTags: ['tenantsDirectory']
			}),
			listAdminWithdrawalRequests: build.query<any[], { status?: string } | void>({
				query: (arg) => ({
					url: '/api/tenants/admin/withdrawals',
					params: arg && typeof arg === 'object' && arg.status ? { status: arg.status } : undefined
				})
			}),
			approveAdminSettlement: build.mutation<any, string>({
				query: (id) => ({ url: `/api/tenants/admin/settlements/${id}/approve`, method: 'PATCH' }),
				invalidatesTags: ['tenantsDirectory']
			}),
			rejectAdminSettlement: build.mutation<any, { id: string; reason?: string }>({
				query: ({ id, reason }) => ({
					url: `/api/tenants/admin/settlements/${id}/reject`,
					method: 'PATCH',
					body: { reason }
				}),
				invalidatesTags: ['tenantsDirectory']
			}),
			assignTenantServingMerchant: build.mutation<
				{
					tenant_id: string;
					serving_merchant_id: string | null;
					previous_merchant_id: string | null;
					unchanged?: boolean;
				},
				{ tenantId: string; merchant_id: string | null; reason?: string }
			>({
				query: ({ tenantId, ...body }) => ({
					url: `/api/tenants/admin/${tenantId}/serving-merchant`,
					method: 'PUT',
					body
				}),
				invalidatesTags: ['tenantsDirectory']
			})
		}),
		overrideExisting: false
	});

export default TenantsDirectoryApi;

export const {
	useGetTenantsDirectoryListQuery,
	useGetTenantDirectoryDetailQuery,
	useLazyGetTenantDirectoryDetailQuery,
	useGetAdminTenantSettlementSummaryQuery,
	useGetAdminTenantSettlementsQuery,
	useCreateAdminTenantSettlementMutation,
	useMarkAdminSettlementPaidMutation,
	useListAdminWithdrawalRequestsQuery,
	useApproveAdminSettlementMutation,
	useRejectAdminSettlementMutation,
	useAssignTenantServingMerchantMutation
} = TenantsDirectoryApi;
