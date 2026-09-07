import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import { Paper } from '@mui/material';
import { Expense } from './ExpenseApi';
import { formatDate } from 'date-fns';
import { formatGhsCurrency } from '../dashboards/analytics/daily-sales/formatGhsCurrency';

export type ExpensesTableProps = {
	data: Expense[];
	isLoading: boolean;
};

function ExpensesTable({ data, isLoading }: ExpensesTableProps) {
	
	const columns = useMemo<MRT_ColumnDef<Expense>[]>(
		() => [
			{
				accessorKey: 'expense_date',
				header: 'Expense Date',
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				accessorFn: (row) => row.expense_date ? new Date(row.expense_date).toDateString(): "N/A"
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				accessorFn: (row) => formatGhsCurrency(row.amount, 2, 2)
			},
			{
				accessorKey: 'note',
				header: 'Description',
				accessorFn: (row) => row.note
			},
			{
				accessorKey: 'warehouse',
				header: 'Warehouse',
				accessorFn: (row) => row.warehouse
			},
			{
				accessorKey: 'category',
				header: 'Category',
				accessorFn: (row) => row.category
			},
			{
				accessorKey: 'expensed_by',
				header: 'Expensed By',
				accessorFn: (row) => row.expensed_by
			},
			{
				accessorKey: 'created_at',
				header: 'Date Added',
				accessorFn: (row) => row.created_at ? formatDate(new Date(row.created_at), 'MM/dd/yyyy:HH:mm') : "N/A"
			}
		],
		[formatDate]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<DataTable
				data={data}
				columns={columns}
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: true,
				}}
				enableRowSelection={false}
				enableRowActions={false}
				// renderRowActionMenuItems={({ closeMenu, row, table }) => [
				// 	<MenuItem
				// 		key={0}
				// 		onClick={() => {
				// 			removeCategory(row.original.id);
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
				// 				removeexpenses(selectedRows.map((row) => row.original.id));
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

export default ExpensesTable;
