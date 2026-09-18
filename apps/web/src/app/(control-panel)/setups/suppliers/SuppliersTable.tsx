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
	const rows = useMemo(() => (Array.isArray(suppliers) ? suppliers : []), [suppliers]);

	const columns = useMemo<MRT_ColumnDef<Supplier>[]>(
		() => [
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

	const initialState = useMemo(
		() => ({
			density: 'compact' as const,
			showColumnFilters: false,
			showGlobalFilter: true
		}),
		[]
	);

	const state = useMemo(() => ({ isLoading }), [isLoading]);

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<DataTable
				data={rows}
				columns={columns}
				initialState={initialState}
				state={state}
				enableRowSelection={false}
				enableRowActions={false}
			/>
		</Paper>
	);
}

export default SuppliersTable;
