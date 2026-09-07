import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';
import WarehouseModel, { type WarehousePrinterType } from './models/WarehouseModel';

export const addTagTypes = ['warehouses'] as const;

const WarehouseApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getWarehouses: build.query<GetWarehousesApiResponse, GetWarehousesApiArg>({
				query: () => ({ url: `/api/warehouses` }),
				// providesTags: ['warehouses']
			}),
			getWarehouse: build.query<GetWarehouseApiResponse, GetWarehouseApiArg>({
				query: (warehouseId) => ({
					url: `/api/warehouses/${warehouseId}`
				}),
				// providesTags: ['']
			}),
			createWarehouse: build.mutation<CreateWarehouseApiResponse, CreateWarehouseApiArg>({
				query: (newWarehouse) => ({
					url: `/api/warehouses`,
					method: 'POST',
					body: WarehouseModel(newWarehouse)
				}),
				// invalidatesTags: ['']
			}),
			updateWarehouse: build.mutation<CreateWarehouseApiResponse, CreateWarehouseApiArg>({
				query: (location) => ({
					url: `/api/warehouses/${location.id}`,
					method: 'PUT',
					body: WarehouseModel(location)
				}),
				// providesTags: ['']
			}),
		}),
		overrideExisting: false
	});

export default WarehouseApi;

export type GetWarehousesApiResponse = /** status 200 OK */ Warehouse[];
export type GetWarehousesApiArg = void;

export type GetWarehouseApiResponse = /** status 200 OK */ Warehouse;
export type GetWarehouseApiArg = string;

export type CreateWarehouseApiResponse = /** status 200 OK */ Warehouse;
export type CreateWarehouseApiArg = PartialDeep<Warehouse>;

export type Warehouse = {
	id: string;
	name: string;
	manager: string;
	phone: string;
	address: string;
	location: string;
	user: string;
	notes: string[];
	printer_type: WarehousePrinterType;
	minimum_order_amount?: number;
	reference_code?: string;
	created_at: string;
}

export const { useGetWarehouseQuery, useGetWarehousesQuery, useCreateWarehouseMutation, useUpdateWarehouseMutation } = WarehouseApi;

export type WarehouseApiType = {
	[WarehouseApi.reducerPath]: ReturnType<typeof WarehouseApi.reducer>;
};
