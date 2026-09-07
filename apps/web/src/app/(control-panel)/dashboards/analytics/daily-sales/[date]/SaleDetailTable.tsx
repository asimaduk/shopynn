'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Typography from '@mui/material/Typography';
import type { SaleDetailLine } from '../dailySalesListData';
import { formatGhsCurrency } from '../formatGhsCurrency';

type SaleDetailTableProps = {
	data: SaleDetailLine[];
};

export default function SaleDetailTable({ data }: SaleDetailTableProps) {
	const columns = useMemo<MRT_ColumnDef<SaleDetailLine>[]>(
		() => [
			{
				accessorKey: 'id',
				header: 'Transaction',
				size: 140,
				muiTableHeadCellProps: { sx: { pl: { xs: 2, sm: 2.5 } } },
				muiTableBodyCellProps: { sx: { pl: { xs: 2, sm: 2.5 } } }
			},
			{
				accessorKey: 'time',
				header: 'Time',
				size: 80
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				size: 120,
				Cell: ({ row }) => formatGhsCurrency(row.original.amount, 2)
			},
			{
				accessorKey: 'items',
				header: 'Items',
				size: 80
			},
			{
				accessorKey: 'customer',
				header: 'Customer',
				size: 140,
				Cell: ({ row }) => row.original.customer ?? '—'
			}
		],
		[]
	);

	return (
		<DataTable
			columns={columns}
			data={data}
			enableRowSelection={false}
			enableRowActions={false}
			localization={{ rowsPerPage: '' }}
			muiTablePaperProps={{
				elevation: 0,
				square: true,
				className: 'flex flex-col flex-auto h-full min-w-0 max-w-full',
				sx: { width: '100%', overflow: 'hidden' }
			}}
			muiTableContainerProps={{
				className: 'flex-auto min-w-0',
				sx: { maxWidth: '100%', overflowX: 'auto' }
			}}
			muiSearchTextFieldProps={{
				placeholder: 'Search',
				sx: {
					minWidth: { xs: 0, sm: '240px' },
					width: { xs: '100%', sm: 'auto' },
					maxWidth: '100%'
				},
				variant: 'outlined',
				size: 'small'
			}}
			muiBottomToolbarProps={{
				className: 'flex items-center min-h-14 h-14 max-w-full min-w-0 flex-wrap'
			}}
			initialState={{
				density: 'compact',
				pagination: { pageSize: 10, pageIndex: 0 },
				showGlobalFilter: true
			}}
			muiPaginationProps={{
				rowsPerPageOptions: [10, 20, 30],
				showRowsPerPage: true,
				sx: { flexWrap: 'wrap', maxWidth: '100%', justifyContent: { xs: 'center', sm: 'flex-end' } }
			}}
		/>
	);
}
