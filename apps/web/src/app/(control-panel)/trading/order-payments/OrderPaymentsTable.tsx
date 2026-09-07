import { useMemo } from 'react';
import type { MRT_ColumnDef } from 'material-react-table';
import { Chip, Paper } from '@mui/material';
import Link from 'next/link';
import DataTable from 'src/components/data-table/DataTable';

type OrderPaymentRow = {
	id?: string;
	created_at?: string;
	order_number?: string;
	order_id?: string;
	amount?: number | string;
	payment_method_type?: string;
	payment_method?: string;
	status?: string;
	transaction_ref?: string;
};

function methodLabel(m?: string) {
	if (!m) return '—';
	const method = String(m).toLowerCase();
	if (method.includes('mobile')) return 'Mobile money';
	if (method.includes('cash')) return 'Cash';
	return 'Card';
}

function statusPill(status?: string) {
	const normalized = String(status || '').toLowerCase();
	if (['completed', 'success', 'paid'].includes(normalized)) return { bg: '#dcfce7', fg: '#16a34a' };
	if (normalized === 'pending') return { bg: '#fef3c7', fg: '#d97706' };
	if (['failed', 'error'].includes(normalized)) return { bg: '#fee2e2', fg: '#dc2626' };
	return { bg: '#f3f4f6', fg: '#6b7280' };
}

export default function OrderPaymentsTable({ rows }: { rows: OrderPaymentRow[] }) {
	const columns = useMemo<MRT_ColumnDef<OrderPaymentRow>[]>(
		() => [
			{
				accessorKey: 'created_at',
				header: 'Date',
				Cell: ({ row }) => (row.original.created_at ? new Date(row.original.created_at).toLocaleString() : '—')
			},
			{
				id: 'order',
				header: 'Order',
				Cell: ({ row }) => row.original.order_number || row.original.order_id || '—'
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => `GHS ${Number(row.original.amount || 0).toFixed(2)}`
			},
			{
				id: 'method',
				header: 'Method',
				Cell: ({ row }) => methodLabel(row.original.payment_method_type || row.original.payment_method)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => {
					const palette = statusPill(row.original.status);
					return (
						<Chip
							size="small"
							label={String(row.original.status || '—').toUpperCase()}
							variant="filled"
							sx={{ backgroundColor: palette.bg, color: palette.fg, fontWeight: 700 }}
						/>
					);
				}
			},
			{
				accessorKey: 'transaction_ref',
				header: 'Reference',
				Cell: ({ row }) => row.original.transaction_ref || '—'
			},
			{
				id: 'actions',
				header: 'Action',
				Cell: ({ row }) => {
					const paymentStatus = String(row.original.status || '').toLowerCase();
					const canViewReceipt = ['paid', 'success', 'completed'].includes(paymentStatus);
					return row.original.id && canViewReceipt ? (
						<Link href={`/trading/order-payments/${row.original.id}`} className="font-semibold text-blue-600 hover:underline">
							View receipt
						</Link>
					) : (
						'—'
					);
				}
			}
		],
		[]
	);

	return (
		<Paper className="flex h-full w-full flex-auto flex-col overflow-hidden rounded-t-lg rounded-b-none shadow-1" elevation={0}>
			<DataTable
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: false
				}}
				data={rows || []}
				columns={columns}
				enableRowSelection={false}
				enableRowActions={false}
			/>
		</Paper>
	);
}
