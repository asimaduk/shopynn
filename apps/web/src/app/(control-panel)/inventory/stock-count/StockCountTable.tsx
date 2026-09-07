'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import type { StockCountRecord } from './stockCountListData';

type StockCountTableProps = {
	data: StockCountRecord[];
};

function statusLabel(status: StockCountRecord['status']) {
	switch (status) {
		case 'completed':
			return 'Completed';
		case 'in_progress':
			return 'In progress';
		case 'scheduled':
			return 'Scheduled';
		default:
			return status;
	}
}

function statusColor(status: StockCountRecord['status']) {
	switch (status) {
		case 'completed':
			return 'success';
		case 'in_progress':
			return 'warning';
		case 'scheduled':
			return 'default';
		default:
			return 'default';
	}
}

export default function StockCountTable({ data }: StockCountTableProps) {
	const columns = useMemo<MRT_ColumnDef<StockCountRecord>[]>(
		() => [
			{
				accessorKey: 'date',
				header: 'Date',
				size: 130,
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				Cell: ({ row }) =>
					new Date(row.original.date).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})
			},
			{
				accessorKey: 'warehouse',
				header: 'Warehouse',
				size: 120
			},
			{
				accessorKey: 'productCount',
				header: 'Products (unique)',
				size: 110
			},
			{
				accessorKey: 'variance',
				header: 'Variance',
				size: 100,
				Cell: ({ row }) => {
					const v = row.original.variance;
					if (v === null || v === undefined) {
						return (
							<Typography variant="body2" color="text.secondary">
								—
							</Typography>
						);
					}
					return (
						<Typography
							className={`font-medium ${v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : ''}`}
						>
							{v > 0 ? `+${v}` : v}
						</Typography>
					);
				}
			},
			{
				id: 'status',
				header: 'Status',
				size: 120,
				accessorKey: 'status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={statusLabel(row.original.status)}
						color={statusColor(row.original.status)}
						variant="outlined"
					/>
				)
			},
			{
				accessorKey: 'conductedBy',
				header: 'Conducted by',
				size: 130
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
			initialState={{
				density: 'compact',
				showColumnFilters: false,
				pagination: { pageSize: 10, pageIndex: 0 },
				showGlobalFilter: true
			}}
			// muiPaginationProps={{
			// 	rowsPerPageOptions: [10, 20, 30],
			// 	showRowsPerPage: true
			// }}
		/>
	);
}
