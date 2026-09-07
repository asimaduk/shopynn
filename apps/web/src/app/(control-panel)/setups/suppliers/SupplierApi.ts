import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';
import SupplierModel from './models/SupplierModel';

export const addTagTypes = ['suppliers'] as const;

const SupplierApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getSuppliers: build.query<GetSuppliersApiResponse, GetSuppliersApiArg>({
				query: () => ({ url: `/api/suppliers` }),
				// providesTags: ['suppliers']
			}),
			getSupplier: build.query<GetSupplierApiResponse, GetSupplierApiArg>({
				query: (supplierId) => ({
					url: `/api/suppliers/${supplierId}`
				}),
				// providesTags: ['']
			}),
			createSupplier: build.mutation<CreateSupplierApiResponse, CreateSupplierApiArg>({
				query: (newSupplier) => ({
					url: `/api/suppliers`,
					method: 'POST',
					body: SupplierModel(newSupplier)
				}),
				// invalidatesTags: ['']
			}),
			updateSupplier: build.mutation<CreateSupplierApiResponse, CreateSupplierApiArg>({
				query: (location) => ({
					url: `/api/suppliers/${location.id}`,
					method: 'PUT',
					body: SupplierModel(location)
				}),
				// providesTags: ['']
			}),
		}),
		overrideExisting: false
	});

export default SupplierApi;

export type GetSuppliersApiResponse = /** status 200 OK */ Supplier[];
export type GetSuppliersApiArg = void;

export type GetSupplierApiResponse = /** status 200 OK */ Supplier;
export type GetSupplierApiArg = string;

export type CreateSupplierApiResponse = /** status 200 OK */ Supplier;
export type CreateSupplierApiArg = PartialDeep<Supplier>;

export type Supplier = {
	id: string;
	name: number;
	manager: string;
	phone: string;
	address: string;
	user: string;
	notes: string[];
	created_at: string;
}

export const { useGetSupplierQuery, useGetSuppliersQuery, useCreateSupplierMutation, useUpdateSupplierMutation } = SupplierApi;

export type SupplierApiType = {
	[SupplierApi.reducerPath]: ReturnType<typeof SupplierApi.reducer>;
};
