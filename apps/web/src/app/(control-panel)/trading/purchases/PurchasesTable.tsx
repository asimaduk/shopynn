import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { Paper } from '@mui/material';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import { Purchase } from '../TradingApi';
import { formatCurrency } from 'src/app/(control-panel)/reports/reportMappers';
// import PurchasesStatus from './PurchasesStatus';

function PurchasesTable({ purchases }) {

	const columns = useMemo<MRT_ColumnDef<Purchase>[]>(
		() => [
			{
				accessorKey: 'created_at',
				header: 'Date',
				accessorFn: (row) => new Date(row.created_at).toLocaleString()
			},
			{
				accessorKey: 'invoice_number',
				header: 'Invoice #',
				size: 64,
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/trading/purchases/${row.original.id}`}
						role="button"
						className="underline"
						sx={{
							color: 'primary.main',
							fontWeight: 600,
							'&:hover': { color: 'primary.dark' }
						}}
					>
						{row.original.invoice_number}
					</Typography>
				)
			},
			{
				id: 'supplier',
				accessorKey: 'supplier',
				accessorFn: (row) => row.supplier,
				header: 'Supplier',
			},
			{
				id: 'total_amount',
				accessorFn: (row) => Number(row.total_amount ?? 0),
				header: 'Total (GHS)',
				size: 120,
				Cell: ({ row }) => (
					<Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
						{formatCurrency(row.original.total_amount)}
					</Typography>
				)
			},
			{ 
				id: 'number_of_items', 
				accessorFn: (row) => row.number_of_items, 
				header: 'Items',
				// size: 128 
			},
			{ 
				id: 'receiver', 
				accessorFn: (row) => row.receiver_name, 
				header: 'Receiver',
				// size: 128 
			},
			// {
			// 	id: 'status',
			// 	accessorFn: (row) => <PurchasesStatus name={`${row.current_status}`} />,
			// 	accessorKey: 'status',
			// 	header: 'Status'
			// }
		],
		[]
	);

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<DataTable
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: true,
					columnPinning: {
						left: ['mrt-row-expand', 'mrt-row-select'],
						right: ['mrt-row-actions']
					},
					pagination: {
						pageIndex: 0,
						pageSize: 20
					}
				}}
				enableRowSelection={false}
				data={purchases || []}
				columns={columns}
				enableRowActions={false}
				// renderRowActionMenuItems={({ closeMenu, row, table }) => [
				// 	<MenuItem
				// 		key={0}
				// 		onClick={() => {
				// 			removeOrders([row.original.id]);
				// 			closeMenu();
				// 			table.resetRowSelection();
				// 		}}
				// 	>
				// 		<ListItemIcon>
				// 			<FuseSvgIcon>heroicons-outline:trash</FuseSvgIcon>
				// 		</ListItemIcon>
				// 		Delete
				// 	</MenuItem>
				// ]}
				// renderTopToolbarCustomActions={({ table }) => {
				// 	const { rowSelection } = table.getState();

				// 	if (Object.keys(rowSelection).length === 0) {
				// 		return null;
				// 	}

				// 	return (
				// 		<Button
				// 			variant="contained"
				// 			size="small"
				// 			onClick={() => {
				// 				const selectedRows = table.getSelectedRowModel().rows;
				// 				removeOrders(selectedRows.map((row) => row.original.id));
				// 				table.resetRowSelection();
				// 			}}
				// 			className="flex shrink min-w-9 ltr:mr-2 rtl:ml-2"
				// 			color="secondary"
				// 		>
				// 			<FuseSvgIcon size={16}>heroicons-outline:trash</FuseSvgIcon>
				// 			<span className="hidden sm:flex mx-2">Delete selected items</span>
				// 		</Button>
				// 	);
				// }}
			/>
		</Paper>
	);
}

export default PurchasesTable;
