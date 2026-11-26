import { apiService as api } from 'src/store/apiService';

const ParityApi = api.injectEndpoints({
	endpoints: (build) => ({
		getReceiptSettings: build.query<any, void>({
			query: () => ({ url: '/api/users/me/preferences' })
		}),
		updateReceiptSettings: build.mutation<any, any>({
			query: (body) => ({ url: '/api/users/me/preferences', method: 'PUT', body })
		}),
		runDataExport: build.query<any, void>({
			query: () => ({ url: '/api/products/export' })
		})
	}),
	overrideExisting: false
});

export const {
	useGetReceiptSettingsQuery,
	useUpdateReceiptSettingsMutation,
	useLazyRunDataExportQuery
} = ParityApi;

export default ParityApi;
