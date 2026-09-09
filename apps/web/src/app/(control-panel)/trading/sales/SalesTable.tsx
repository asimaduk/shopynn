'use client';

import { useMemo, useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { alpha } from '@mui/material/styles';
import Link from '@fuse/core/Link';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { Sale } from '../TradingApi';
import SalesStatus from './SalesStatus';
import { groupSalesByDate } from './groupSalesByDate';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';
import ResendInvoiceButton from './ResendInvoiceButton';
import useUser from '@auth/useUser';
import { hasPermissionCodes } from '@auth/permissions';

function OrdersTable({ sales }: { sales: Sale[] }) {
	const [search, setSearch] = useState('');
	const { data: user } = useUser();
	const canResendInvoice = hasPermissionCodes(user, 'sales.share_receipt');

	const filtered = useMemo(() => {
		const list = sales || [];
		const q = search.trim().toLowerCase();
		if (!q) return list;
		return list.filter((s) => {
			const inv = String(s.invoice_number ?? s.reference ?? '').toLowerCase();
			const cust = String(s.customer ?? '').toLowerCase();
			return inv.includes(q) || cust.includes(q);
		});
	}, [sales, search]);

	const groups = useMemo(() => groupSalesByDate(filtered), [filtered]);

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<Box className="px-3 py-3 border-b" sx={{ borderColor: 'divider' }}>
				<TextField
					size="small"
					fullWidth
					placeholder="Search by customer or invoice…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<FuseSvgIcon color="action">heroicons-outline:magnifying-glass</FuseSvgIcon>
							</InputAdornment>
						)
					}}
				/>
			</Box>

			<Box className="overflow-auto max-h-[calc(100vh-220px)]">
				{groups.length === 0 ? (
					<Box className="py-16 text-center">
						<Typography color="text.secondary">No sales match your search.</Typography>
					</Box>
				) : (
					groups.map((group) => (
						<Box key={group.sortKey} className="mb-3 last:mb-0 px-2 pt-3">
							<Box
								className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-2 border"
								sx={{
									borderLeftWidth: 4,
									borderLeftColor: 'primary.main',
									backgroundColor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.08),
									borderColor: 'divider'
								}}
							>
								<FuseSvgIcon className="text-primary" size={20}>
									heroicons-outline:calendar-days
								</FuseSvgIcon>
								<Typography variant="subtitle1" fontWeight={700} color="text.primary">
									{group.label}
								</Typography>
								<Typography variant="caption" color="text.secondary" className="ml-1">
									({group.items.length} {group.items.length === 1 ? 'sale' : 'sales'})
								</Typography>
							</Box>

							<Table size="small" className="dense">
								<TableHead>
									<TableRow>
										<TableCell>Date</TableCell>
										<TableCell>Reference</TableCell>
										<TableCell>Customer</TableCell>
										<TableCell align="right">Total (GHS)</TableCell>
										<TableCell align="right">Items</TableCell>
										<TableCell>Attendant</TableCell>
										<TableCell>Status</TableCell>
										{canResendInvoice ? <TableCell align="center">Invoice</TableCell> : null}
									</TableRow>
								</TableHead>
								<TableBody>
									{group.items.map((row) => (
										<TableRow key={row.id} hover>
											<TableCell sx={{ whiteSpace: 'nowrap' }}>
												{new Date(row.created_at).toLocaleString()}
											</TableCell>
											<TableCell>
												<Typography
													component={Link}
													to={`/trading/sales/${row.id}`}
													role="button"
													className="underline"
													sx={{
														color: 'primary.main',
														fontWeight: 600,
														'&:hover': { color: 'primary.dark' }
													}}
												>
													{row.invoice_number}
												</Typography>
											</TableCell>
											<TableCell>{row.customer || '—'}</TableCell>
											<TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
												{formatGhsCurrency(Number(String(row.total_amount ?? 0).replace(/,/g, '')), 2, 2)}
											</TableCell>
											<TableCell align="right">{row.number_of_items}</TableCell>
											<TableCell>
												{`${row.attendant_first_name ?? ''} ${row.attendant_last_name ?? ''}`.trim() || '—'}
											</TableCell>
											<TableCell>
												<SalesStatus name={`${row.current_status}`} />
											</TableCell>
											{canResendInvoice ? (
												<TableCell align="center" onClick={(e) => e.stopPropagation()}>
													<ResendInvoiceButton
														saleId={row.id}
														invoiceNumber={row.invoice_number}
														customerName={row.customer}
														customerEmail={(row as Sale & { customer_email?: string }).customer_email}
													/>
												</TableCell>
											) : null}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</Box>
					))
				)}
			</Box>
		</Paper>
	);
}

export default OrdersTable;
