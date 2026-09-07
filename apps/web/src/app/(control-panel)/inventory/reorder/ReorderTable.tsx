'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@fuse/core/Link';
import type { ReorderListItem } from './reorderListData';

type ReorderTableProps = {
	data: ReorderListItem[];
};

export default function ReorderTable({ data }: ReorderTableProps) {
	const columns = useMemo<MRT_ColumnDef<ReorderListItem>[]>(
		() => [
			{
				accessorKey: 'name',
				header: 'Product',
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/inventory/products`}
						className="font-medium"
						sx={{ textDecoration: 'underline' }}
					>
						{row.original.name}
					</Typography>
				)
			},
			{
				accessorKey: 'sku',
				header: 'SKU',
				size: 120
			},
			{
				accessorKey: 'currentStock',
				header: 'Current stock',
				size: 120,
				Cell: ({ row }) => {
					const { currentStock, reorderLevel } = row.original;
					const isCritical = currentStock === 0;
					return (
						<Typography
							className={`font-semibold ${isCritical ? 'text-red-600' : 'text-amber-600'}`}
						>
							{currentStock}
						</Typography>
					);
				}
			},
			{
				accessorKey: 'reorderLevel',
				header: 'Reorder level',
				size: 120
			},
			{
				accessorKey: 'warehouse',
				header: 'Warehouse',
				size: 120
			},
			{
				id: 'status',
				header: 'Status',
				size: 120,
				accessorFn: (row) => (row.currentStock === 0 ? 'critical' : 'low'),
				Cell: ({ row }) => {
					const isCritical = row.original.currentStock === 0;
					return (
						<Chip
							size="small"
							label={isCritical ? 'Critical' : 'Low stock'}
							color={isCritical ? 'error' : 'warning'}
							variant="outlined"
						/>
					);
				}
			},
			{
				accessorKey: 'reportedAt',
				header: 'Reported',
				size: 120,
				Cell: ({ row }) =>
					new Date(row.original.reportedAt).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})
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
