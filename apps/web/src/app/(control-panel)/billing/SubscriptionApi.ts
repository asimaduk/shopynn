import { apiService as api } from 'src/store/apiService';
import type { PayoutProfileInput } from '../trading/order-settlements/settlementUtils';

export type SubscriptionCurrent = {
	subscription?: {
		id?: string;
		subscription_type?: number;
		name?: string;
		status?: string;
		start_at?: string;
		end_at?: string;
		amount?: number;
		currency?: string;
		features?: string[];
		limits?: {
			maxUsers: number;
			maxWarehouses: number;
			maxLocations: number;
			userCount: number;
			warehouseCount: number;
			locationCount: number;
		};
	};
	recentPayments?: PaymentRecord[];
};

export type PaymentRecord = {
	id?: string;
	created_at?: string;
	amount?: number;
	currency?: string;
	payment_method?: string;
	status?: string;
	reference?: string;
	order_id?: string;
	order_number?: string;
	transaction_ref?: string;
	payment_method_type?: string;
	creator_id?: string;
	creator_first_name?: string;
	creator_last_name?: string;
	customer_first_name?: string;
	customer_last_name?: string;
	warehouse_name?: string;
};

const subscriptionTagTypes = ['payoutProfile', 'settlements'] as const;

const SubscriptionApi = api.enhanceEndpoints({ addTagTypes: subscriptionTagTypes }).injectEndpoints({
	endpoints: (build) => ({
		getCurrentSubscription: build.query<SubscriptionCurrent | null, void | { payments_limit?: number }>({
			query: (arg) => ({
				url: '/api/subscriptions/current',
				params:
					arg && typeof arg === 'object' && arg.payments_limit != null
						? { payments_limit: arg.payments_limit }
						: undefined
			})
		}),
		getSubscriptionBillingPayments: build.query<PaymentRecord[], void>({
			query: () => ({ url: '/api/subscriptions/current', params: { payments_limit: 200 } }),
			transformResponse: (raw: SubscriptionCurrent | null) => raw?.recentPayments ?? []
		}),
		getPayments: build.query<PaymentRecord[], Record<string, any> | void>({
			query: (params) => ({ url: '/api/payments', params }),
			transformResponse: (raw: any) => (Array.isArray(raw) ? raw : raw?.items ?? raw?.list ?? raw?.data ?? [])
		}),
		getPaymentReceipt: build.query<any, string>({
			query: (id) => ({ url: `/api/payments/${id}/receipt` })
		}),
		getPaymentEvents: build.query<any[], string>({
			query: (id) => ({ url: `/api/payments/${id}/events` }),
			transformResponse: (raw: any) => (Array.isArray(raw) ? raw : raw?.items ?? raw?.list ?? raw?.data ?? [])
		}),
		reversePayment: build.mutation<any, { id: string; reason?: string }>({
			query: ({ id, reason }) => ({ url: `/api/payments/${id}/reverse`, method: 'POST', body: { reason } })
		}),
		initiatePayment: build.mutation<any, any>({
			query: (body) => ({ url: '/api/payments/initiate', method: 'POST', body })
		}),
		onboardSubscription: build.mutation<any, { subscription_type: number }>({
			query: (body) => ({ url: '/api/subscriptions/onboard', method: 'POST', body })
		}),
		verifyPayment: build.query<any, string>({
			query: (reference) => ({ url: `/api/payments/verify/${reference}` })
		}),
		getMySettlementSummary: build.query<
			{
				digital_collected: number;
				settled_paid: number;
				pending_settlements: number;
				available_balance: number;
				currency: string;
			},
			void
		>({
			query: () => ({ url: '/api/tenants/me/settlements/summary' }),
			providesTags: ['settlements']
		}),
		getMySettlements: build.query<any[], void>({
			query: () => ({ url: '/api/tenants/me/settlements' }),
			transformResponse: (raw: any) => (Array.isArray(raw) ? raw : raw?.items ?? raw?.list ?? raw?.data ?? []),
			providesTags: ['settlements']
		}),
		getMyPayoutProfile: build.query<PayoutProfileInput | null, void>({
			query: () => ({ url: '/api/tenants/me/payout-profile' }),
			providesTags: ['payoutProfile']
		}),
		getPayoutBankOptions: build.query<{ name: string; code: string; slug?: string | null }[], 'ghipss' | 'mobile_money'>({
			query: (type) => ({ url: '/api/tenants/payout-banks', params: { type } })
		}),
		updateMyPayoutProfile: build.mutation<any, Record<string, unknown>>({
			query: (body) => ({ url: '/api/tenants/me/payout-profile', method: 'PUT', body }),
			invalidatesTags: ['payoutProfile']
		}),
		requestMyWithdrawal: build.mutation<any, { amount: number; note?: string }>({
			query: (body) => ({ url: '/api/tenants/me/withdrawals', method: 'POST', body }),
			invalidatesTags: ['payoutProfile', 'settlements']
		}),
		retryMyWithdrawal: build.mutation<any, string>({
			query: (id) => ({ url: `/api/tenants/me/withdrawals/${id}/retry`, method: 'POST' }),
			invalidatesTags: ['settlements']
		})
	}),
	overrideExisting: false
});

export const {
	useGetCurrentSubscriptionQuery,
	useGetSubscriptionBillingPaymentsQuery,
	useGetPaymentsQuery,
	useGetPaymentReceiptQuery,
	useGetPaymentEventsQuery,
	useReversePaymentMutation,
	useInitiatePaymentMutation,
	useOnboardSubscriptionMutation,
	useLazyVerifyPaymentQuery,
	useGetMySettlementSummaryQuery,
	useGetMySettlementsQuery,
	useGetMyPayoutProfileQuery,
	useGetPayoutBankOptionsQuery,
	useUpdateMyPayoutProfileMutation,
	useRequestMyWithdrawalMutation,
	useRetryMyWithdrawalMutation
} = SubscriptionApi;

export default SubscriptionApi;
