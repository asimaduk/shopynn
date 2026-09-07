import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { Paper } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from 'next/link';
import { ProductTransaction } from '../ECommerceApi';
import { URLS } from '@/configs/settingsConfig';

type Props = {
	transactions: ProductTransaction[];
};

function TransactionsTable({ transactions }: Props) {
	const columns = useMemo<MRT_ColumnDef<ProductTransaction>[]>(
		() => [
			{
				accessorFn: (row) => row.thumbnail,
				id: 'thumbnail',
				header: '',
				enableColumnFilter: false,
				enableColumnDragging: false,
				size: 64,
				enableSorting: false,
				Cell: ({ row }) => (
					<div className="flex items-center justify-center">
						{row.original.thumbnail ? (
							<img
								className="block max-h-9 max-w-9 rounded-sm"
								src={`${URLS.serverUrl}/images?id=${row.original.thumbnail}`}
								alt={row.original.name ?? ''}
							/>
						) : (
							<img
								className="block max-h-9 max-w-9 rounded-sm"
								src="/assets/images/apps/ecommerce/product-image-placeholder.png"
								alt={row.original.name ?? ''}
							/>
						)}
					</div>
				)
			},
			{
				accessorKey: 'type',
				header: 'Type',
				accessorFn: (row) => (
					<div className="flex items-center">
						{row.type === 1 ? (
							<FuseSvgIcon className="text-green-500" size={20}>
								heroicons-outline:check-circle
							</FuseSvgIcon>
						) : (
							<FuseSvgIcon className="text-red-500" size={20}>
								heroicons-outline:minus-circle
							</FuseSvgIcon>
						)}
						{row.type === 1 ? <span className="ml-4">Received</span> : <span className="ml-4">Sold</span>}
					</div>
				)
			},
			{
				accessorKey: 'name',
				header: 'Name',
				Cell: ({ row }) => {
					const href =
						row.original.type === 1
							? `/trading/purchases/${row.original.purchase_id}`
							: `/trading/sales/${row.original.sale_id}`;
					return (
						<Link href={href} className="text-primary-600 underline">
							{row.original.name}
						</Link>
					);
				}
			},
			{
				accessorKey: 'quantity',
				header: 'QTY',
				accessorFn: (row) => row.quantity
			},
			{
				accessorKey: 'unit_price',
				header: 'Price',
				accessorFn: (row) => `₵ ${row.unit_price}`
			},
			{
				header: 'Total',
				Cell: ({ row }) => (
					<div>{(Number(row.original.quantity) * Number(row.original.unit_price)).toFixed(2)}</div>
				)
			},
			{
				accessorKey: 'warehouse',
				header: 'Store',
				accessorFn: (row) => row.warehouse
			},
			{
				accessorKey: 'attendant',
				header: 'Attendant',
				accessorFn: (row) => row.attendant
			},
			{
				accessorKey: 'created_at',
				header: 'Date',
				accessorFn: (row) => (row.created_at ? new Date(row.created_at).toLocaleString() : '—')
			}
		],
		[]
	);

	return (
		<Paper
			className="flex h-full w-full flex-auto flex-col overflow-hidden rounded-t-lg rounded-b-none shadow-1"
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
				}}
				data={transactions || []}
				columns={columns}
				enableRowSelection={false}
				enableRowActions={false}
			/>
		</Paper>
	);
}

export default TransactionsTable;
