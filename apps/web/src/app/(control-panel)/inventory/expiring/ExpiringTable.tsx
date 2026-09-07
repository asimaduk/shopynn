'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@fuse/core/Link';
import type { ExpiringListItem } from './expiringListData';

type ExpiringTableProps = {
	data: ExpiringListItem[];
};

export default function ExpiringTable({ data }: ExpiringTableProps) {
	const columns = useMemo<MRT_ColumnDef<ExpiringListItem>[]>(
		() => [
			{
				accessorKey: 'name',
				header: 'Product',
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to="/inventory/products"
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
				accessorKey: 'quantity',
				header: 'Quantity',
				size: 100
			},
			{
				accessorKey: 'expiryDate',
				header: 'Expiry date',
				size: 130,
				Cell: ({ row }) =>
					new Date(row.original.expiryDate).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})
			},
			{
				accessorKey: 'daysUntilExpiry',
				header: 'Days left',
				size: 100,
				Cell: ({ row }) => {
					const days = row.original.daysUntilExpiry;
					const isUrgent = days <= 7;
					return (
						<Typography
							className={`font-semibold ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}
						>
							{days} days
						</Typography>
					);
				}
			},
			{
				accessorKey: 'warehouse',
				header: 'Warehouse',
				size: 120,
				Cell: ({ row }) => row.original.warehouse ?? '—'
			},
			{
				id: 'status',
				header: 'Status',
				size: 120,
				accessorFn: (row) => (row.daysUntilExpiry <= 7 ? 'urgent' : 'soon'),
				Cell: ({ row }) => {
					const isUrgent = row.original.daysUntilExpiry <= 7;
					return (
						<Chip
							size="small"
							label={isUrgent ? 'Urgent' : 'Soon'}
							color={isUrgent ? 'error' : 'warning'}
							variant="outlined"
						/>
					);
				}
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
