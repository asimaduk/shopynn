import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';

export const addTagTypes = ['settings_users', 'settings_user', 'settings_roles'] as const;

export type SystemUser = {
	id: string;
	last_login?: string;
	email: string;
	first_name: string;
	last_name: string;
	phone?: string | null;
	user_type: number; // 1 = admin, 2 = staff, etc.
	is_active: boolean;
	warehouse_id?: string | null;
	warehouse_name?: string | null;
	created_at?: string;
	updated_at?: string;
	roles: Role[];
	deleted?: boolean;
	deleted_at?: string;
	deleted_reason?: string;
	deleted_by?: string;
	role_id?: string | null;
};

export type SystemUserCreate = {
	email: string;
	first_name: string;
	last_name: string;
	phone?: string | null;
	user_type?: number | null;
	warehouse_id?: string | null;
	role_id?: string | null;
};

export type SystemUserUpdate = PartialDeep<Omit<SystemUser, 'id'>> & { password?: string; id?: string };


export type Role = {
	id: string;
	name: string;
	description?: string | null;
	user_count?: number;
};

const UsersApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getRoles: build.query<Role[], void>({
				query: () => ({ url: `/api/roles` }),
				providesTags: ['settings_roles'],
				transformResponse: (raw: any) => {
					const data = raw?.data ?? raw;
					if (Array.isArray(data)) return data;
					if (Array.isArray(data?.data)) return data.data;
					return [];
				}
			}),
			getUsers: build.query<SystemUser[], void>({
				query: () => ({ url: `/api/users` }),
				providesTags: ['settings_users'],
				transformResponse: (response: SystemUser[] | { users?: SystemUser[] }) =>
					Array.isArray(response) ? response : response?.users ?? []
			}),
			getUser: build.query<SystemUser, string>({
				query: (userId) => ({ url: `/api/users/${userId}` }),
				providesTags: (_result, _err, id) => [{ type: 'settings_user', id }]
			}),
			createUser: build.mutation<SystemUser, SystemUserCreate>({
				query: (body) => ({
					url: `/api/users`,
					method: 'POST',
					body
				}),
				invalidatesTags: ['settings_users']
			}),
			updateUser: build.mutation<SystemUser, { id: string; data: SystemUserUpdate }>({
				query: ({ id, data }) => ({
					url: `/api/users/${id}`,
					method: 'PUT',
					body: data
				}),
				invalidatesTags: (_r, _e, arg) => [
					'settings_users',
					{ type: 'settings_user', id: arg.id }
				]
			}),
			disableUser: build.mutation<SystemUser, { id: string; is_active: boolean }>({
				query: ({ id, is_active }) => ({
					url: `/api/users/${id}`,
					method: 'PUT',
					body: { is_active }
				}),
				invalidatesTags: (_r, _e, arg) => [
					'settings_users',
					{ type: 'settings_user', id: arg.id }
				]
			})
		}),
		overrideExisting: false
	});

export default UsersApi;

export const {
	useGetUsersQuery,
	useGetUserQuery,
	useCreateUserMutation,
	useUpdateUserMutation,
	useDisableUserMutation,
	useGetRolesQuery
} = UsersApi;
