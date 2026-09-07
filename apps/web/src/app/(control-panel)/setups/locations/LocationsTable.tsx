'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { Paper } from '@mui/material';
import { Location } from './LocationApi';
import MenuItem from '@mui/material/MenuItem';
// import { deleteLocationService } from 'ims-services/src/controllers/location';
import ListItemIcon from '@mui/material/ListItemIcon';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useNavigate from '@fuse/hooks/useNavigate';

type LocationsTableProps = {
	data: Location[];
	isLoading: boolean;
};

function LocationsTable({ data: locations, isLoading }: LocationsTableProps) {
	const navigate = useNavigate();

	const columns = useMemo<MRT_ColumnDef<Location>[]>(
		() => [
			// {
			// 	accessorFn: (row) => row.featuredImageId,
			// 	id: 'featuredImageId',
			// 	header: '',
			// 	enableColumnFilter: false,
			// 	enableColumnDragging: false,
			// 	size: 64,
			// 	enableSorting: false,
			// 	Cell: ({ row }) => (
			// 		<div className="flex items-center justify-center">
			// 			{row.original?.images?.length > 0 && row.original.featuredImageId ? (
			// 				<img
			// 					className="w-full max-h-9 max-w-9 block rounded-sm"
			// 					src={_.find(row.original.images, { id: row.original.featuredImageId })?.url}
			// 					alt={row.original.name}
			// 				/>
			// 			) : (
			// 				<img
			// 					className="w-full max-h-9 max-w-9 block rounded-sm"
			// 					src="/assets/images/apps/ecommerce/product-image-placeholder.png"
			// 					alt={row.original.name}
			// 				/>
			// 			)}
			// 		</div>
			// 	)
			// },
			{
				accessorKey: 'name',
				header: 'Name',
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{(row.original as any)?.name ?? ''}</span>
					</div>
				)
			},
			{
				accessorKey: 'manager',
				header: 'Manager',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{(row.original as any)?.manager ?? ''}</span>
					</div>
				)
			},
			{
				accessorKey: 'phone',
				header: 'Phone',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{(row.original as any)?.phone ?? ''}</span>
					</div>
				)
			},
			{
				id: 'warehousesCount',
				header: 'Warehouses',
				size: 110,
				enableColumnFilter: false,
				accessorFn: (row) => {
					const count = Number((row as any)?.warehouses_count ?? (row as any)?.warehousesCount ?? 0);
					return Number.isFinite(count) ? count : 0;
				}
			},
			// {
			// 	accessorKey: 'address',
			// 	header: 'Address',
			// 	accessorFn: (row) => (
			// 		<div className="flex flex-wrap space-x-0.5">
			// 			<span>{row.address}</span>
			// 		</div>
			// 	)
			// },
			{
				accessorKey: 'created_at',
				header: 'Date Added',
				accessorFn: (row) => (row as any)?.created_at ?? '',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>
							{(row.original as any)?.created_at ? new Date((row.original as any).created_at).toDateString() : 'N/A'}
						</span>
					</div>
				)
			}
		],
		[]
	);

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<DataTable
				data={locations ?? []}
				columns={columns}
				state={{ isLoading }}
				initialState={{ density: 'compact' }}
				enableRowSelection={false}
				globalFilterFn="contains"
				renderRowActionMenuItems={({ closeMenu, row, table }) => [
					<MenuItem
						key={0}
						onClick={() => {
							closeMenu();
							// table.resetRowSelection();
							navigate(`/setups/locations/${row.original.id}/edit`);
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:pencil-square</FuseSvgIcon>
						</ListItemIcon>
						Edit
					</MenuItem>
				]}
			/>
		</Paper>
	);
}

export default LocationsTable;
