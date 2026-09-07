'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@fuse/core/Link';
import type { SaleReturnRecord } from './returnsListData';

type ReturnsTableProps = { data: SaleReturnRecord[] };

function statusColor(s: SaleReturnRecord['status']) {
	switch (s) {
		case 'approved':
			return 'success';
		case 'pending':
			return 'warning';
		case 'rejected':
			return 'error';
		default:
			return 'default';
	}
}

export default function ReturnsTable({ data }: ReturnsTableProps) {
	const columns = useMemo<MRT_ColumnDef<SaleReturnRecord>[]>(
		() => [
			{
				accessorKey: 'reference',
				header: 'Reference',
				size: 140,
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/trading/sales/returns/${row.original.id}`}
						className="font-medium"
						sx={{ textDecoration: 'underline' }}
					>
						{row.original.reference}
					</Typography>
				)
			},
			{
				accessorKey: 'date',
				header: 'Date',
				size: 120,
				Cell: ({ row }) =>
					new Date(row.original.date).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})
			},
			{ accessorKey: 'customer', header: 'Customer', size: 140 },
			{
				accessorKey: 'originalSaleRef',
				header: 'Original sale',
				size: 120
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				size: 110,
				Cell: ({ row }) =>
					row.original.amount.toLocaleString('en-US', {
						style: 'currency',
						currency: 'USD',
						maximumFractionDigits: 2
					})
			},
			{
				accessorKey: 'status',
				header: 'Status',
				size: 110,
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={row.original.status}
						color={statusColor(row.original.status)}
						variant="outlined"
					/>
				)
			}
		],
		[]
	);

	return (
		<DataTable
			columns={columns}
			data={data}
			initialState={{
				pagination: { pageSize: 10, pageIndex: 0 },
				showGlobalFilter: true
			}}
			muiPaginationProps={{ rowsPerPageOptions: [10, 20, 30], showRowsPerPage: true }}
		/>
	);
}
