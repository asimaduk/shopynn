'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import type { DailySaleRow } from './dailySalesListData';
import { formatGhsCurrency } from './formatGhsCurrency';

type DailySalesTableProps = {
	data: DailySaleRow[];
};

export default function DailySalesTable({ data }: DailySalesTableProps) {
	const columns = useMemo<MRT_ColumnDef<DailySaleRow>[]>(
		() => [
			{
				accessorKey: 'date',
				header: 'Date',
				size: 140,
				muiTableHeadCellProps: { sx: { pl: { xs: 2, sm: 2.5 } } },
				muiTableBodyCellProps: { sx: { pl: { xs: 2, sm: 2.5 } } },
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/dashboards/analytics/daily-sales/${row.original.date}`}
						className="font-medium"
						sx={{ textDecoration: 'underline' }}
					>
						{new Date(row.original.date).toLocaleDateString('en-US', {
							weekday: 'short',
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})}
					</Typography>
				)
			},
			{
				accessorKey: 'sales',
				header: 'Sales',
				size: 100,
				Cell: ({ row }) => (
					<Typography className="font-medium">{row.original.sales}</Typography>
				)
			},
			{
				accessorKey: 'revenue',
				header: 'Revenue',
				size: 130,
				Cell: ({ row }) => formatGhsCurrency(row.original.revenue, 0)
			},
			{
				accessorKey: 'transactions',
				header: 'Transactions',
				size: 120
			},
			{
				accessorKey: 'averageOrder',
				header: 'Avg order',
				size: 120,
				Cell: ({ row }) => formatGhsCurrency(row.original.averageOrder, 0)
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
