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

const subscriptionTagTypes = ['payoutProfile', 'settlements', 'posPendingMomo'] as const;

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
		submitPaymentOtp: build.mutation<any, { reference: string; otp: string }>({
			query: (body) => ({ url: '/api/payments/submit-otp', method: 'POST', body })
		}),
		getOpenPosMomoPayment: build.query<
			{
				id?: string;
				transaction_ref?: string;
				status?: string;
				reuse_mode?: 'success' | 'pending';
				face_amount?: number;
				fee_amount?: number;
				amount?: number;
			} | null,
			{ face_amount: number; phone?: string }
		>({
			query: (params) => ({ url: '/api/payments/pos-open', params })
		}),
		abandonPosMomoPayment: build.mutation<any, { reference: string }>({
			query: (body) => ({ url: '/api/payments/pos-abandon', method: 'POST', body }),
			invalidatesTags: ['posPendingMomo']
		}),
		parkPosMomoPayment: build.mutation<any, { reference: string; cart_snapshot: Record<string, unknown> }>({
			query: (body) => ({ url: '/api/payments/pos-park', method: 'POST', body }),
			invalidatesTags: ['posPendingMomo']
		}),
		getPendingPosMomoPayments: build.query<any[], { status?: string } | void>({
			query: (params) => ({ url: '/api/payments/pos-pending', params: params || undefined }),
			transformResponse: (raw: any) => (Array.isArray(raw) ? raw : raw?.items ?? raw?.list ?? raw?.data ?? []),
			providesTags: ['posPendingMomo']
		}),
		onboardSubscription: build.mutation<any, { subscription_type: number }>({
			query: (body) => ({ url: '/api/subscriptions/onboard', method: 'POST', body })
		}),
		verifyPayment: build.query<any, string>({
			query: (reference) => ({ url: `/api/payments/verify/${reference}` })
		}),
		getMomoPaymentCharge: build.query<
			{ enabled: boolean; percent: number; min_percent: number },
			void
		>({
			query: () => ({ url: '/api/platform-settings/momo-payment-charge' })
		}),
		updateMomoPaymentCharge: build.mutation<
			{ enabled: boolean; percent: number; min_percent: number },
			{ enabled?: boolean; percent?: number }
		>({
			query: (body) => ({ url: '/api/platform-settings/momo-payment-charge', method: 'PUT', body })
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
		resolvePayoutAccount: build.query<
			{ account_number: string; account_name: string; bank_id?: number | null; stub?: boolean },
			{ account_number: string; bank_code: string }
		>({
			query: ({ account_number, bank_code }) => ({
				url: '/api/tenants/payout-account-resolve',
				params: { account_number, bank_code }
			})
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
	useSubmitPaymentOtpMutation,
	useOnboardSubscriptionMutation,
	useLazyVerifyPaymentQuery,
	useLazyGetOpenPosMomoPaymentQuery,
	useAbandonPosMomoPaymentMutation,
	useParkPosMomoPaymentMutation,
	useGetPendingPosMomoPaymentsQuery,
	useLazyGetPendingPosMomoPaymentsQuery,
	useGetMomoPaymentChargeQuery,
	useUpdateMomoPaymentChargeMutation,
	useGetMySettlementSummaryQuery,
	useGetMySettlementsQuery,
	useGetMyPayoutProfileQuery,
	useGetPayoutBankOptionsQuery,
	useLazyResolvePayoutAccountQuery,
	useUpdateMyPayoutProfileMutation,
	useRequestMyWithdrawalMutation,
	useRetryMyWithdrawalMutation
} = SubscriptionApi;

export default SubscriptionApi;
