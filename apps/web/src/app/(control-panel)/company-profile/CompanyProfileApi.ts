import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';
import { normalizeBulkDiscount, DEFAULT_BULK_DISCOUNT } from '@/utils/bulkDiscount';

export const addTagTypes = ['company_profile', 'industries'] as const;

export type BulkDiscountSettings = {
	enabled: boolean;
	quantity_threshold: number;
};

export type CompanyProfile = {
	id?: string;
	companyName: string;
	organization?: string;
	address?: string;
	phone?: string;
	email?: string;
	website?: string;
	industryId?: string | null;
	industryLabel?: string | null;
	/** Image key stored on tenants.logo (served via /api/images?id=…). */
	logo?: string | null;
	bulkDiscount?: BulkDiscountSettings;
};

export type IndustryOption = {
	id: string;
	name: string;
	description?: string | null;
};

type MeCompany = {
	name?: string | null;
	address?: string | null;
	phone?: string | null;
	email?: string | null;
	organization?: string | null;
	website?: string | null;
	industry?: string | null;
	industry_id?: string | null;
	logo?: string | null;
	settings?: {
		bulk_discount?: Partial<BulkDiscountSettings> | null;
	} | null;
};

type MeResponse = {
	company?: MeCompany | null;
};

function mapMeToCompanyProfile(me: MeResponse | null | undefined): CompanyProfile | null {
	const bulkDiscount = normalizeBulkDiscount(me?.company?.settings?.bulk_discount);
	const logo = me?.company?.logo ?? null;
	const base: CompanyProfile = {
		id: 'tenant',
		companyName: me?.company?.name?.trim() || '',
		organization: me?.company?.organization ?? undefined,
		address: me?.company?.address ?? undefined,
		phone: me?.company?.phone ?? undefined,
		email: me?.company?.email ?? undefined,
		website: me?.company?.website ?? undefined,
		industryId: me?.company?.industry_id ?? null,
		industryLabel: me?.company?.industry && me.company.industry !== 'Not set' ? me.company.industry : null,
		logo,
		bulkDiscount
	};
	return base;
}

const CompanyProfileApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getCompanyProfile: build.query<CompanyProfile | null, void>({
				query: () => ({ url: `/api/users/me` }),
				providesTags: ['company_profile'],
				transformResponse: (raw: MeResponse) => mapMeToCompanyProfile(raw) ?? null
			}),
			getIndustriesForCompany: build.query<IndustryOption[], void>({
				query: () => ({ url: `/api/industries` }),
				providesTags: ['industries'],
				transformResponse: (raw: unknown): IndustryOption[] => {
					const list = Array.isArray(raw) ? raw : [];
					return list
						.map((row) => {
							const r = row as {
								id?: string;
								name?: string;
								code?: string;
								description?: string | null;
							};
							return {
								id: String(r.id || r.code || ''),
								name: String(r.name || r.code || 'Industry'),
								description: r.description ?? null
							};
						})
						.filter((row) => row.id);
				}
			}),
			uploadCompanyLogo: build.mutation<{ ids?: string[] }, FormData>({
				query: (body) => ({
					url: `/api/images`,
					method: 'POST',
					body
				})
			}),
			updateCompanyProfile: build.mutation<CompanyProfile, PartialDeep<CompanyProfile> & { industryOther?: string }>({
				query: (body) => {
					const industryId =
						body.industryId === 'other'
							? body.industryOther || undefined
							: body.industryId || undefined;
					return {
						url: `/api/tenants/update-my-company-info`,
						method: 'PUT',
						body: {
							name: body.companyName,
							organization: body.organization,
							address: body.address,
							phone: body.phone,
							email: body.email,
							website: body.website,
							...(industryId !== undefined ? { industry_id: industryId } : {}),
							...(body.logo !== undefined ? { logo: body.logo } : {}),
							settings: body.bulkDiscount
								? {
										bulk_discount: normalizeBulkDiscount(body.bulkDiscount)
									}
								: undefined
						}
					};
				},
				invalidatesTags: ['company_profile']
			})
		}),
		overrideExisting: false
	});

export default CompanyProfileApi;

export const {
	useGetCompanyProfileQuery,
	useGetIndustriesForCompanyQuery,
	useUpdateCompanyProfileMutation,
	useUploadCompanyLogoMutation
} = CompanyProfileApi;

export type CompanyProfileApiType = {
	[CompanyProfileApi.reducerPath]: ReturnType<typeof CompanyProfileApi.reducer>;
};

/** Consider profile "set" if company name is present */
export function isCompanyProfileSet(profile: CompanyProfile | null | undefined): boolean {
	return Boolean(profile?.companyName?.trim());
}

export { DEFAULT_BULK_DISCOUNT };
