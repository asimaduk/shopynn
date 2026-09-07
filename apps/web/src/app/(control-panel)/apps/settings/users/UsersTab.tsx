'use client';

import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import useUser from '@auth/useUser';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import { Paper } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import useNavigate from '@fuse/hooks/useNavigate';
import { SystemUser, useGetUsersQuery, useDisableUserMutation } from './UsersApi';
import toast from 'react-hot-toast';
import UsersHeader from './UsersHeader';

function userLabel(row: SystemUser) {
	return `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—';
}

function UsersTab() {
	const navigate = useNavigate();
	const { data: authUser } = useUser();
	const planUsage = authUser?.company?.plan_usage ?? authUser?.company?.subscription?.limits;
	const userAddBlocked = Boolean(planUsage && planUsage.userCount >= planUsage.maxUsers);

	const { data: users, isLoading } = useGetUsersQuery(undefined, { refetchOnMountOrArgChange: true });
	const [disableUser] = useDisableUserMutation();

	const rows = users ?? [];
	const { userCount, activeCount, disabledCount } = useMemo(() => {
		const userCount = rows.length;
		const activeCount = rows.filter((u) => u.is_active !== false).length;
		return { userCount, activeCount, disabledCount: userCount - activeCount };
	}, [rows]);

	const columns = useMemo<MRT_ColumnDef<SystemUser>[]>(
		() => [
			{
				accessorKey: 'first_name',
				header: 'Name',
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				accessorFn: (row) => userLabel(row),
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/users/staff/${row.original.id}/view`}
						className="font-semibold"
						sx={{ textDecoration: 'underline', display: 'inline-block' }}
					>
						{userLabel(row.original)}
					</Typography>
				)
			},
			{
				accessorKey: 'email',
				header: 'Email',
				accessorFn: (row) => row.email || '—'
			},
			{
				accessorKey: 'roles',
				header: 'Role',
				accessorFn: (row) => row.roles?.map(r=> r.name).join(', ') || '—'
			},
			{
				accessorKey: 'warehouse_name',
				header: 'Warehouse',
				accessorFn: (row) => row.warehouse_name || '—'
			},
			{
				id: 'is_active',
				header: 'Status',
				accessorFn: (row) =>
					row.is_active !== false ? (
						<Chip size="small" label="Active" color="success" variant="outlined" />
					)
					: 
					row.deleted !== false ? (
						<Chip size="small" label="Deleted" color="error" variant="outlined" />
					)
					: (
						<Chip size="small" label="Disabled" color="default" variant="outlined" />
					)
			},
			{
				accessorKey: 'created_at',
				header: 'Created',
				accessorFn: (row) =>
					row.created_at
						? new Date(row.created_at).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})
						: '—'
			}
		],
		[]
	);

	const handleToggleActive = async (user: SystemUser) => {
		try {
			await disableUser({ id: user.id, is_active: !user.is_active }).unwrap();
			toast.success(user.is_active ? 'User disabled' : 'User enabled');
		} catch {
			toast.error('Failed to update user');
		}
	};

	return (
		<div className="w-full h-full flex flex-col px-4">
			{userAddBlocked && planUsage ? (
				<Alert severity="warning" className="mt-4 shrink-0">
					You are using {planUsage.userCount} of {planUsage.maxUsers} users allowed on your{' '}
					{planUsage.tierDisplay ?? 'current'} plan. Remove a user or upgrade to add more.
				</Alert>
			) : null}
			<UsersHeader
				userCount={userCount}
				activeCount={activeCount}
				disabledCount={disabledCount}
				isLoading={isLoading}
				addBlocked={userAddBlocked}
			/>

			<Paper className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full" elevation={0}>
				<DataTable
					data={rows}
					columns={columns}
					initialState={{
						density: 'compact',
						showColumnFilters: false,
						showGlobalFilter: true,
					}}
					state={{ isLoading }}
					enableRowSelection={false}
					enableRowActions
					renderRowActionMenuItems={({ row, closeMenu }) => {
						if (row.original.deleted === true) {
							return [];
						}
						return [
							<MenuItem
								key={row.original.id}
								onClick={() => {
									closeMenu();
									navigate(`/users/staff/${row.original.id}`);
								}}
							>
								<ListItemIcon>
									<FuseSvgIcon size={20}>heroicons-outline:pencil-square</FuseSvgIcon>
								</ListItemIcon>
								Edit
							</MenuItem>,
							<MenuItem
								key="toggle"
								onClick={() => {
									handleToggleActive(row.original);
									closeMenu();
								}}
							>
								<ListItemIcon>
									<FuseSvgIcon size={20}>
										{row.original.is_active !== false
											? 'heroicons-outline:no-symbol'
											: 'heroicons-outline:check-circle'}
									</FuseSvgIcon>
								</ListItemIcon>
								{row.original.is_active !== false ? 'Disable user' : 'Enable user'}
							</MenuItem>
						];
					}}
				/>
			</Paper>
		</div>
	);
}

export default UsersTab;
