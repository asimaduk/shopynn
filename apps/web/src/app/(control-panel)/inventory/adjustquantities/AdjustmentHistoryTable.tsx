'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import type { AdjustmentRecord } from './adjustmentHistoryData';

type Props = { data: AdjustmentRecord[] };

export default function AdjustmentHistoryTable({ data }: Props) {
	const columns = useMemo<MRT_ColumnDef<AdjustmentRecord>[]>(
		() => [
			{
				accessorKey: 'reference',
				header: 'Reference',
				size: 120,
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } }
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
			{ accessorKey: 'warehouse', header: 'Warehouse', size: 120 },
			{ accessorKey: 'productsCount', header: 'Products', size: 100 },
			{ accessorKey: 'notes', header: 'Notes', size: 180},
			{ accessorKey: 'createdBy', header: 'Created by', size: 120 }
		],
		[]
	);

	return (
		<DataTable
			columns={columns}
			enableRowSelection={false}
			enableRowActions={false}
			data={data}
			initialState={{
				density: 'compact',
				showColumnFilters: false,
				pagination: { pageSize: 10, pageIndex: 0 },
				showGlobalFilter: true
			}}
			// muiPaginationProps={{ rowsPerPageOptions: [10, 20, 30], showRowsPerPage: true }}
		/>
	);
}
