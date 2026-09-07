import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';

export const addTagTypes = ['company_profile'] as const;

export type CompanyProfile = {
	id?: string;
	companyName: string;
	address?: string;
	phone?: string;
	email?: string;
	website?: string;
};

type MeCompany = {
	name?: string | null;
	address?: string | null;
	phone?: string | null;
	email?: string | null;
	organization?: string | null;
	website?: string | null;
};

type MeResponse = {
	company?: MeCompany | null;
};

function mapMeToCompanyProfile(me: MeResponse | null | undefined): CompanyProfile | null {
	if (!me?.company?.name?.trim()) {
		return {
			id: 'tenant',
			companyName: '',
			address: me?.company?.address ?? undefined,
			phone: me?.company?.phone ?? undefined,
			email: me?.company?.email ?? undefined,
			website: me?.company?.website ?? undefined
		};
	}
	const c = me.company;
	return {
		id: c.name || 'tenant',
		companyName: c.name ?? '',
		address: c.address ?? undefined,
		phone: c.phone ?? undefined,
		email: c.email ?? undefined,
		website: c.website ?? undefined
	};
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
			updateCompanyProfile: build.mutation<CompanyProfile, PartialDeep<CompanyProfile>>({
				query: (body) => ({
					url: `/api/tenants/update-my-company-info`,
					method: 'PUT',
					body: {
						name: body.companyName,
						address: body.address,
						phone: body.phone,
						email: body.email,
						website: body.website
					}
				}),
				invalidatesTags: ['company_profile']
			})
		}),
		overrideExisting: false
	});

export default CompanyProfileApi;

export const { useGetCompanyProfileQuery, useUpdateCompanyProfileMutation } = CompanyProfileApi;

export type CompanyProfileApiType = {
	[CompanyProfileApi.reducerPath]: ReturnType<typeof CompanyProfileApi.reducer>;
};

/** Consider profile "set" if company name is present */
export function isCompanyProfileSet(profile: CompanyProfile | null | undefined): boolean {
	return Boolean(profile?.companyName?.trim());
}
