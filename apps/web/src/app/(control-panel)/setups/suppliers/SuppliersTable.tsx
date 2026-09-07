import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Link from '@fuse/core/Link';
import { Paper } from '@mui/material';
import _ from 'lodash';
import { Supplier } from './SupplierApi';

type SuppliersTableProps = {
	data: Supplier[];
	isLoading: boolean;
};

function SuppliersTable({ data: suppliers, isLoading }: SuppliersTableProps) {

	const columns = useMemo<MRT_ColumnDef<Supplier>[]>(
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
				accessorFn: (row) => (row.name != null ? String(row.name) : '—'),
				Cell: ({ row }) => (
					<Link
						to={`/setups/suppliers/${row.original.id}/view`}
						className="font-medium"
						sx={{ textDecoration: 'underline' }}
					>
						{row.original.name != null ? String(row.original.name) : '—'}
					</Link>
				)
			},
			{
				accessorKey: 'manager',
				header: 'Manager',
				accessorFn: (row) => row.manager
			},
			{
				accessorKey: 'phone',
				header: 'Phone',
				accessorFn: (row) => row.phone
			},
			{
				accessorKey: 'address',
				header: 'Address',
				accessorFn: (row) => row.address
			},
			{
				accessorKey: 'created_at',
				header: 'Date Added',
				accessorFn: (row) => row.created_at ? new Date(row.created_at).toDateString() : "N/A"
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
				data={suppliers}
				columns={columns}
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: true,
				}}
				state={{ isLoading }}
				enableRowSelection={false}
				enableRowActions={false}
			/>
		</Paper>
	);
}

export default SuppliersTable;
