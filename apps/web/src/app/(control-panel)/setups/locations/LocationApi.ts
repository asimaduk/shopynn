import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';
import LocationModel from './models/LocationModel';

export const addTagTypes = ['locations'] as const;

const LocationApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getLocations: build.query<GetLocationsApiResponse, GetLocationsApiArg>({
				query: () => ({ url: `/api/locations` }),
				// providesTags: ['locations']
			}),
			getLocation: build.query<GetLocationApiResponse, GetLocationApiArg>({
				query: (productId) => ({
					url: `/api/locations/${productId}`
				}),
				// providesTags: ['']
			}),
			createLocation: build.mutation<CreateLocationApiResponse, CreateLocationApiArg>({
				query: (newLocation) => ({
					url: `/api/locations`,
					method: 'POST',
					body: LocationModel(newLocation)
				}),
				// invalidatesTags: ['']
			}),
			updateLocation: build.mutation<CreateLocationApiResponse, CreateLocationApiArg>({
				query: (location) => ({
					url: `/api/locations/${location.id}`,
					method: 'PUT',
					body: LocationModel(location)
				}),
				// providesTags: ['']
			}),
		}),
		overrideExisting: false
	});

export default LocationApi;

export type GetLocationsApiResponse = /** status 200 OK */ Location[];
export type GetLocationsApiArg = void;

export type GetLocationApiResponse = /** status 200 OK */ Location;
export type GetLocationApiArg = string;

export type CreateLocationApiResponse = /** status 200 OK */ Location;
export type CreateLocationApiArg = PartialDeep<Location>;

export type Location = {
	id: string;
	name: number;
	manager: string;
	phone: string;
	address: string;
	user: string;
	notes: string[];
	created_at: string;
}

export const { useGetLocationQuery, useGetLocationsQuery, useCreateLocationMutation, useUpdateLocationMutation } = LocationApi;

export type LocationApiType = {
	[LocationApi.reducerPath]: ReturnType<typeof LocationApi.reducer>;
};
