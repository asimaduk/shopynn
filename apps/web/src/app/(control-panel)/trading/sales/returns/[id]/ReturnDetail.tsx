'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import { useParams } from 'next/navigation';
import Link from '@fuse/core/Link';
import ReturnDetailHeader from './ReturnDetailHeader';
import { useMemo } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetReturnQuery } from '../../../TradingApi';
import type { SaleReturnRecord } from '../returnsListData';
import { formatGhsCurrency } from '../../../../dashboards/analytics/daily-sales/formatGhsCurrency';

function statusColor(s: string) {
	switch (s) {
		case 'approved': return 'success';
		case 'pending': return 'warning';
		case 'rejected': return 'error';
		default: return 'default';
	}
}

export default function ReturnDetail() {
	const params = useParams();
	const id = typeof params?.id === 'string' ? params.id : null;
	const { data, isLoading } = useGetReturnQuery(id ?? '', { skip: !id });
	const record: SaleReturnRecord | null = useMemo(() => {
		if (!data?.id) return null;
		const status = String(data.status || '').toLowerCase();
		return {
			id: data.id,
			reference: data.reference_number || data.id,
			date: data.created_at || '',
			customer: data.customer_name || 'Walk-in',
			originalSaleRef: data.sale_invoice_number || data.order_number || '—',
			amount: Number(data.total_amount || data.refund_amount || 0),
			status: status === 'draft' ? 'pending' : status === 'cancelled' ? 'rejected' : 'approved',
			items: (Array.isArray(data.details) ? data.details : []).map((d: any) => ({
				productName: d.product_name || '—',
				sku: d.sku || '—',
				quantity: Number(d.quantity) || 0,
				unitPrice: Number(d.unit_price) || 0,
				reason: d.reason || data.reason || undefined
			}))
		};
	}, [data]);

	if (id && isLoading) return <FuseLoading />;

	if (!id || !record) {
		return (
			<div className="w-full flex flex-col px-4 py-8">
				<Typography color="text.secondary">Return not found.</Typography>
				<Button component={Link} to="/trading/sales/returns" className="mt-2" sx={{ alignSelf: 'flex-start' }}>
					Back to returns
				</Button>
			</div>
		);
	}

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full h-full flex flex-col px-4">
				<ReturnDetailHeader reference={record.reference} />
				<Paper className="p-6 shadow-sm rounded-xl max-w-4xl">
					<div className="grid grid-cols-2 gap-4 mb-6">
						<div>
							<Typography variant="caption" color="text.secondary">Date</Typography>
							<Typography>
								{new Date(record.date).toLocaleDateString('en-US', {
									weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
								})}
							</Typography>
						</div>
						<div>
							<Typography variant="caption" color="text.secondary">Customer</Typography>
							<Typography>{record.customer}</Typography>
						</div>
						<div>
							<Typography variant="caption" color="text.secondary">Original sale</Typography>
							<Typography>{record.originalSaleRef}</Typography>
						</div>
						<div>
							<Typography variant="caption" color="text.secondary">Status</Typography>
							<Chip size="small" label={record.status} color={statusColor(record.status)} variant="outlined" />
						</div>
						<div>
							<Typography variant="caption" color="text.secondary">Total amount</Typography>
							<Typography fontWeight="bold">
								{formatGhsCurrency(record.amount, 2, 2)}
							</Typography>
						</div>
					</div>
					<Typography variant="subtitle2" className="mb-2">Returned items</Typography>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>Product</TableCell>
								<TableCell>SKU</TableCell>
								<TableCell align="right">Qty</TableCell>
								<TableCell align="right">Unit price</TableCell>
								<TableCell align="right">Total</TableCell>
								<TableCell>Reason</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{record.items.map((line, i) => (
								<TableRow key={i}>
									<TableCell>{line.productName}</TableCell>
									<TableCell>{line.sku}</TableCell>
									<TableCell align="right">{line.quantity}</TableCell>
									<TableCell align="right">
										{formatGhsCurrency(line.unitPrice, 2, 2)}
									</TableCell>
									<TableCell align="right">
										{formatGhsCurrency((line.quantity * line.unitPrice), 2, 2)}
									</TableCell>
									<TableCell>{line.reason ?? '—'}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Paper>
			</div>
		</>
	);
}
