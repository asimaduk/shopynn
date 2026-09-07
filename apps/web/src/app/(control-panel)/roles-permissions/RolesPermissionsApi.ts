import { apiService as api } from 'src/store/apiService';
import type { Role } from '../apps/settings/users/UsersApi';

export type Permission = {
	id: string;
	name?: string;
	code?: string;
	description?: string | null;
};

function normalizeArray(raw: unknown): unknown[] {
	if (Array.isArray(raw)) return raw;
	if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
		return (raw as { data: unknown[] }).data;
	}
	return [];
}

const RolesPermissionsApi = api
	.enhanceEndpoints({ addTagTypes: ['settings_roles'] as const })
	.injectEndpoints({
		endpoints: (build) => ({
			getPermissions: build.query<Permission[], void>({
				query: () => ({ url: '/api/permissions' }),
				transformResponse: (raw: unknown) => {
					const list = normalizeArray(raw);
					return list.map((p: any) => ({
						id: String(p?.id ?? ''),
						name: p?.name,
						code: p?.code,
						description: p?.description ?? null
					})) as Permission[];
				}
			}),
			getRolePermissions: build.query<Permission[], string>({
				query: (roleId) => ({ url: `/api/roles/${roleId}/permissions` }),
				transformResponse: (raw: unknown) => {
					const list = normalizeArray(raw);
					return list.map((p: any) => ({
						id: String(p?.id ?? ''),
						name: p?.name,
						code: p?.code,
						description: p?.description ?? null
					})) as Permission[];
				}
			}),
			createRole: build.mutation<Role, { name: string; description?: string | null; permission_ids: string[] }>({
				query: (body) => ({
					url: '/api/roles',
					method: 'POST',
					body: {
						name: body.name,
						description: body.description ?? null,
						permission_ids: body.permission_ids,
						permissions: body.permission_ids
					}
				}),
				invalidatesTags: ['settings_roles']
			}),
			updateRole: build.mutation<
				Role,
				{ id: string; name: string; description?: string | null; permission_ids: string[] }
			>({
				query: ({ id, name, description, permission_ids }) => ({
					url: `/api/roles/${id}`,
					method: 'PUT',
					body: {
						name,
						description: description ?? null,
						permission_ids,
						permissions: permission_ids
					}
				}),
				invalidatesTags: ['settings_roles']
			}),
			deleteRole: build.mutation<void, string>({
				query: (id) => ({
					url: `/api/roles/${id}`,
					method: 'DELETE'
				}),
				invalidatesTags: ['settings_roles']
			})
		}),
	overrideExisting: false
});

export const {
	useGetPermissionsQuery,
	useGetRolePermissionsQuery,
	useCreateRoleMutation,
	useUpdateRoleMutation,
	useDeleteRoleMutation
} = RolesPermissionsApi;

export default RolesPermissionsApi;
