import { apiService as api } from 'src/store/apiService';

export type MeResponse = {
	first_name?: string;
	last_name?: string;
	email?: string;
	phone?: string;
	warehouse_id?: string;
	warehouse_name?: string;
	company?: {
		name?: string | null;
		address?: string | null;
		phone?: string | null;
		email?: string | null;
		industry?: string | null;
		organization?: string | null;
	};
	settings?: {
		roles?: { name?: string }[];
		permissions?: { code?: string }[];
	};
};

export type MePreferences = Record<string, any>;

export type MtdSales = {
	totalSales?: number;
	transactionsCount?: number;
};

const ProfileApi = api.injectEndpoints({
	endpoints: (build) => ({
		getMe: build.query<MeResponse | null, void>({
			query: () => ({ url: '/api/users/me' })
		}),
		getMePreferences: build.query<MePreferences | null, void>({
			query: () => ({ url: '/api/users/me/preferences' })
		}),
		updateMePreferences: build.mutation<any, any>({
			query: (body) => ({ url: '/api/users/me/preferences', method: 'PUT', body })
		}),
		updateProfileUser: build.mutation<any, { id: string; body: any }>({
			query: ({ id, body }) => ({ url: `/api/users/${id}`, method: 'PUT', body })
		}),
		uploadMyProfileImage: build.mutation<any, File>({
			queryFn: async (file, _apiCtx, _extra, baseQuery) => {
				const form = new FormData();
				form.append('image', file);
				const result = await baseQuery({ url: '/api/users/me/profile-image', method: 'POST', body: form });
				if (result.error) {
					const data = result.error.data as { message?: string; status?: number } | undefined;
					return {
						error: {
							...result.error,
							data: {
								...(typeof data === 'object' && data ? data : {}),
								message:
									data?.message ||
									(result.error.status === 503
										? 'File uploads require S3 configuration.'
										: 'Failed to upload profile image.')
							}
						}
					};
				}
				const body = result.data as { status?: number; message?: string; data?: unknown } | undefined;
				if (body && typeof body === 'object' && body.status && body.status !== 200) {
					return {
						error: {
							status: body.status,
							data: { message: body.message || 'Failed to upload profile image.' }
						}
					};
				}
				return { data: (body as any)?.data ?? result.data };
			}
		}),
		removeMyProfileImage: build.mutation<any, void>({
			query: () => ({ url: '/api/users/me/profile-image', method: 'DELETE' })
		}),
		getMyMtdSales: build.query<MtdSales | null, void>({
			query: () => ({ url: '/api/sales/me/mtd-total' })
		})
	}),
	overrideExisting: false
});

export const {
	useGetMeQuery,
	useGetMePreferencesQuery,
	useUpdateMePreferencesMutation,
	useUpdateProfileUserMutation,
	useUploadMyProfileImageMutation,
	useRemoveMyProfileImageMutation,
	useGetMyMtdSalesQuery
} = ProfileApi;

export default ProfileApi;

