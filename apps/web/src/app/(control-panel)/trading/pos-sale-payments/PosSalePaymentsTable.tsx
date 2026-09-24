'use client';

import { useMemo } from 'react';
import type { MRT_ColumnDef } from 'material-react-table';
import { Chip, Paper } from '@mui/material';
import Link from 'next/link';
import DataTable from 'src/components/data-table/DataTable';

type PosSalePaymentRow = {
	id?: string;
	created_at?: string;
	sale_invoice_number?: string;
	sale_id?: string;
	sale_row_id?: string;
	sale_customer_name?: string;
	amount?: number | string;
	face_amount?: number | string;
	status?: string;
	transaction_ref?: string;
	warehouse_name?: string;
};

function statusPill(status?: string) {
	const normalized = String(status || '').toLowerCase();
	if (['completed', 'success', 'paid'].includes(normalized)) return { bg: '#dcfce7', fg: '#16a34a' };
	if (['pending', 'otp', 'ongoing', 'send_otp'].includes(normalized)) return { bg: '#fef3c7', fg: '#d97706' };
	if (['failed', 'error', 'abandoned'].includes(normalized)) return { bg: '#fee2e2', fg: '#dc2626' };
	return { bg: '#f3f4f6', fg: '#6b7280' };
}

export default function PosSalePaymentsTable({ rows }: { rows: PosSalePaymentRow[] }) {
	const columns = useMemo<MRT_ColumnDef<PosSalePaymentRow>[]>(
		() => [
			{
				accessorKey: 'created_at',
				header: 'Date',
				Cell: ({ row }) => (row.original.created_at ? new Date(row.original.created_at).toLocaleString() : '—')
			},
			{
				id: 'sale',
				header: 'Sale',
				Cell: ({ row }) => {
					const label = row.original.sale_invoice_number || row.original.sale_id || 'Unlinked';
					const saleId = row.original.sale_id || row.original.sale_row_id;
					if (saleId) {
						return (
							<Link href={`/trading/sales/${saleId}`} className="font-semibold text-blue-600 hover:underline">
								{label}
							</Link>
						);
					}
					return label;
				}
			},
			{
				id: 'customer',
				header: 'Customer',
				Cell: ({ row }) => row.original.sale_customer_name || '—'
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => {
					const face = Number(row.original.face_amount ?? row.original.amount ?? 0);
					return `GHS ${face.toFixed(2)}`;
				}
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
				id: 'store',
				header: 'Store',
				Cell: ({ row }) => row.original.warehouse_name || '—'
			},
			{
				id: 'actions',
				header: 'Action',
				Cell: ({ row }) => {
					const paymentStatus = String(row.original.status || '').toLowerCase();
					const canViewReceipt = ['paid', 'success', 'completed'].includes(paymentStatus);
					return row.original.id && canViewReceipt ? (
						<Link
							href={`/trading/pos-sale-payments/${row.original.id}`}
							className="font-semibold text-blue-600 hover:underline"
						>
							View
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
