import { apiService as api } from 'src/store/apiService';

export type BillingCatalogItem = {
	id: string;
	code: string;
	item_type: 'subscription_monthly' | 'onboarding' | 'addon';
	plan_tier: string | null;
	label: string;
	description: string | null;
	amount_ghs: number;
	min_amount_ghs: number | null;
	max_amount_ghs: number | null;
	commission_eligible: string;
	is_active: boolean;
	sort_order: number;
};

export type BillingCatalogGrouped = {
	items: BillingCatalogItem[];
	plans: Record<string, Record<string, BillingCatalogItem>>;
	addons: BillingCatalogItem[];
};

/** Flat list response when `grouped=false` (admin catalog table). */
export type BillingCatalogFlat = { items: BillingCatalogItem[] };

export type BillingCatalogResponse = BillingCatalogGrouped | BillingCatalogFlat;

export function isBillingCatalogGrouped(
	data: BillingCatalogResponse | undefined
): data is BillingCatalogGrouped {
	return Boolean(data && 'plans' in data);
}

/** Normalize query result for plan/add-on helpers (grouped endpoint only). */
export function toGroupedBillingCatalog(
	data: BillingCatalogResponse | undefined
): BillingCatalogGrouped | undefined {
	return isBillingCatalogGrouped(data) ? data : undefined;
}

export const billingCatalogTagTypes = ['billingCatalog'] as const;

const BillingCatalogApi = api
	.enhanceEndpoints({ addTagTypes: billingCatalogTagTypes })
	.injectEndpoints({
		endpoints: (build) => ({
			getBillingCatalog: build.query<
				BillingCatalogResponse,
				{ grouped?: boolean; activeOnly?: boolean } | void
			>({
				query: (arg) => ({
					url: '/api/billing/catalog',
					params: {
						grouped: arg && arg.grouped === false ? 'false' : 'true',
						...(arg && arg.activeOnly === false ? { active_only: 'false' } : {})
					}
				}),
				providesTags: ['billingCatalog']
			}),
			updateBillingCatalogItem: build.mutation<
				{ item: BillingCatalogItem },
				{ id: string; body: Partial<BillingCatalogItem> }
			>({
				query: ({ id, body }) => ({
					url: `/api/billing/catalog/${id}`,
					method: 'PATCH',
					body
				}),
				invalidatesTags: ['billingCatalog']
			})
		}),
		overrideExisting: false
	});

export default BillingCatalogApi;

export const { useGetBillingCatalogQuery, useUpdateBillingCatalogItemMutation } = BillingCatalogApi;
