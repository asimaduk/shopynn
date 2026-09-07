import { useMemo } from 'react';
import type { MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { Paper, Chip } from '@mui/material';
import Link from 'next/link';

type StoreOrder = {
	id: string;
	order_number?: string;
	status?: string;
	fulfillment_type?: string;
	total_amount?: number | string;
	warehouse_name?: string;
	warehouse_id?: string;
	customer_name?: string;
	created_at?: string;
	updated_at?: string;
	/** online order payment: unpaid | pending | paid | failed | etc. */
	payment_status?: string;
};

type Props = {
	orders: StoreOrder[];
};

function formatStatusLabel(value: string) {
	return String(value || '')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: string) {
	const normalized = String(status || '').toLowerCase();
	if (normalized === 'completed') return 'success';
	if (normalized === 'cancelled') return 'error';
	if (normalized === 'confirmed') return 'info';
	if (normalized === 'processing') return 'info';
	if (normalized === 'ready') return 'secondary';
	return 'warning';
}

function statusPillSx(status: string) {
	const normalized = String(status || '').toLowerCase();
	if (normalized === 'completed') return { bgcolor: '#dcfce7', color: '#16a34a' };
	if (normalized === 'cancelled') return { bgcolor: '#fee2e2', color: '#dc2626' };
	if (normalized === 'confirmed') return { bgcolor: '#dbeafe', color: '#2563eb' };
	if (normalized === 'processing') return { bgcolor: '#dbeafe', color: '#2563eb' };
	if (normalized === 'ready') return { bgcolor: '#ede9fe', color: '#7c3aed' };
	// pending/confirmed/shipped/delivered etc.
	return { bgcolor: '#fef3c7', color: '#d97706' };
}

function getDeliveryStatus(order: StoreOrder) {
	const mode = String(order.fulfillment_type || 'pickup').toLowerCase();
	const status = String(order.status || '').toLowerCase();
	if (mode !== 'delivery') return 'N/A';
	if (status === 'shipped') return 'In transit';
	if (status === 'delivered' || status === 'completed') return 'Delivered';
	if (status === 'cancelled') return 'Cancelled';
	return 'Awaiting dispatch';
}

function paymentPillSx(payment: string) {
	const normalized = String(payment || '').toLowerCase();
	if (normalized === 'paid') return { bgcolor: '#dcfce7', color: '#16a34a' };
	if (normalized === 'failed') return { bgcolor: '#fee2e2', color: '#dc2626' };
	if (normalized === 'pending') return { bgcolor: '#fef3c7', color: '#d97706' };
	return { bgcolor: '#f3f4f6', color: '#6b7280' };
}

export default function StoreOrdersTable({ orders }: Props) {
	const columns = useMemo<MRT_ColumnDef<StoreOrder>[]>(
		() => [
			{
				accessorKey: 'order_number',
				header: 'Order #',
				Cell: ({ row }) => (
					<Link href={`/trading/store-orders/${row.original.id}`} className="text-primary-600 underline">
						{row.original.order_number || row.original.id}
					</Link>
				)
			},
			{
				accessorKey: 'created_at',
				header: 'Created',
				Cell: ({ row }) => (row.original.created_at ? new Date(row.original.created_at).toLocaleString() : '—')
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={formatStatusLabel(String(row.original.status || ''))}
						color={statusColor(String(row.original.status || '')) as any}
						variant="filled"
						sx={{
							...statusPillSx(String(row.original.status || '')),
							border: 'none',
							fontWeight: 700,
							'& .MuiChip-label': { px: 1 }
						}}
					/>
				)
			},
			{
				accessorKey: 'payment_status',
				header: 'Payment',
				Cell: ({ row }) => {
					const ps = String(row.original.payment_status || 'unpaid').toLowerCase();
					return (
						<Chip
							size="small"
							label={formatStatusLabel(ps || 'unpaid')}
							variant="filled"
							sx={{
								...paymentPillSx(ps),
								border: 'none',
								fontWeight: 700,
								'& .MuiChip-label': { px: 1 }
							}}
						/>
					);
				}
			},
			{
				accessorKey: 'warehouse_name',
				header: 'Store',
				Cell: ({ row }) => row.original.warehouse_name || row.original.warehouse_id || '—'
			},
			{
				accessorKey: 'customer_name',
				header: 'Customer',
				Cell: ({ row }) => row.original.customer_name || '—'
			},
			{
				accessorKey: 'fulfillment_type',
				header: 'Mode',
				Cell: ({ row }) => {
					const value = String(row.original.fulfillment_type || 'pickup').toLowerCase();
					return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—';
				}
			},
			{
				id: 'delivery_status',
				header: 'Delivery Status',
				enableSorting: false,
				Cell: ({ row }) => getDeliveryStatus(row.original)
			},
			{
				accessorKey: 'total_amount',
				header: 'Total',
				Cell: ({ row }) => `GHS ${Number(row.original.total_amount || 0).toFixed(2)}`
			},
			{
				id: 'actions',
				header: '',
				size: 70,
				muiTableHeadCellProps: {
					sx: {
						width: 70,
						maxWidth: 70,
						px: 1,
						'& .Mui-TableHeadCell-Content': { display: 'none' }
					}
				},
				muiTableBodyCellProps: {
					sx: {
						width: 70,
						maxWidth: 70,
						px: 1,
						whiteSpace: 'nowrap'
					}
				},
				enableSorting: false,
				enableColumnFilter: false,
				Cell: ({ row }) => (
					<Link href={`/trading/store-orders/${row.original.id}`} className="text-primary-600 underline">
						Process
					</Link>
				)
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
					showGlobalFilter: true
				}}
				data={orders || []}
				columns={columns}
				enableRowSelection={false}
				enableRowActions={false}
			/>
		</Paper>
	);
}
