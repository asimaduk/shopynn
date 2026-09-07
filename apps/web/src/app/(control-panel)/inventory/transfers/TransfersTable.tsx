import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { ListItemIcon, MenuItem, Paper } from '@mui/material';
import _ from 'lodash';
// import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
// import Link from '@fuse/core/Link';
// import Typography from '@mui/material/Typography';
// import clsx from 'clsx';
import { EcommerceTransfer } from '../ECommerceApi';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useNavigate from '@fuse/hooks/useNavigate';

function TransfersTable({ transfers }) {
	const navigate = useNavigate();	

	const columns = useMemo<MRT_ColumnDef<EcommerceTransfer>[]>(
		() => [
			{
				accessorKey: 'notes',
				header: 'Note',
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				accessorFn: (row) => row.notes
			},
			{
				accessorKey: 'source',
				header: 'Source Loc.',
				accessorFn: (row) => row.source
			},
			{
				accessorKey: 'destination',
				header: 'Destination Loc.',
				accessorFn: (row) => row.destination
			},
			{
				accessorKey: 'number_of_items',
				header: 'Total Qty.',
				accessorFn: (row) => row.number_of_items
			},
			// {
			// 	accessorKey: 'unit_price',
			// 	header: 'Receipt Status',
			// 	accessorFn: (row) => `₵ ${row.unit_price}`
			// },
			{
				accessorKey: 'created_at',
				header: 'Date',
				accessorFn: (row) => new Date(row.created_at).toLocaleString()
			},
			{
				accessorKey: 'attendant',
				header: 'Attendant',
				accessorFn: (row) => row.attendant
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
				data={transfers || []}
				columns={columns}
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: true,
					columnPinning: {
						left: ['mrt-row-expand', 'mrt-row-select'],
						right: ['mrt-row-actions']
					},
				}}
				enableRowSelection={false}
				renderRowActionMenuItems={({ closeMenu, row, table }) => [
					<MenuItem
						key={0}
						onClick={() => {
							navigate(`/inventory/transfers/${row.original.id}`);
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:list-bullet</FuseSvgIcon>
						</ListItemIcon>
						Details
					</MenuItem>,
				]}
			/>
		</Paper>
	);
}

export default TransfersTable;
