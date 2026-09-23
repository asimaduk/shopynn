'use client';

import FusePageCarded from '@fuse/core/FusePageCarded';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { motion } from 'motion/react';
import Link from '@fuse/core/Link';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseLoading from '@fuse/core/FuseLoading';
import { useMemo, useState } from 'react';
import { useGetOutstandingArQuery } from '../../TradingApi';
import { formatGhsCurrency } from '../../../dashboards/analytics/daily-sales/formatGhsCurrency';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';

/**
 * Outstanding AR balances for POS credit / partial sales.
 */
function OutstandingBalancesPage() {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const [mode, setMode] = useState<'customer' | 'sales'>('customer');
	const [customerFilter, setCustomerFilter] = useState<string | undefined>();

	const queryArg = useMemo(() => {
		if (mode === 'customer' && !customerFilter) {
			return { group_by: 'customer' };
		}
		return customerFilter ? { customer_id: customerFilter } : {};
	}, [mode, customerFilter]);

	const { data, isLoading, isFetching } = useGetOutstandingArQuery(queryArg);

	const customers = data?.customers || [];
	const items = data?.items || [];
	const total = Number(data?.total_outstanding) || 0;

	return (
		<FusePageCarded
			header={
				<div className="flex flex-1 flex-col py-8">
					<motion.div
						initial={{ x: 20, opacity: 0 }}
						animate={{ x: 0, opacity: 1, transition: { delay: 0.2 } }}
					>
						<PageBreadcrumb className="mb-2" />
					</motion.div>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div>
							<Typography className="text-3xl font-extrabold tracking-tight">Balances owed</Typography>
							<Typography color="text.secondary" className="mt-1">
								{formatGhsCurrency(total, 2, 2)} outstanding
							</Typography>
						</div>
						<div className="flex items-center gap-2">
							<ToggleButtonGroup
								size="small"
								exclusive
								value={mode}
								onChange={(_e, v) => {
									if (!v) return;
									setMode(v);
									setCustomerFilter(undefined);
								}}
							>
								<ToggleButton value="customer">By customer</ToggleButton>
								<ToggleButton value="sales">By sale</ToggleButton>
							</ToggleButtonGroup>
							<Button component={Link} to="/trading/sales" variant="outlined">
								All sales
							</Button>
						</div>
					</div>
				</div>
			}
			content={
				<div className="p-4 sm:p-6 w-full">
					{isLoading || isFetching ? (
						<FuseLoading />
					) : mode === 'customer' && !customerFilter ? (
						customers.length === 0 ? (
							<Typography color="text.secondary">No outstanding balances.</Typography>
						) : (
							<div className="table-responsive border rounded-md">
								<table className="simple">
									<thead>
										<tr>
											<th>
												<Typography className="font-semibold">Customer</Typography>
											</th>
											<th>
												<Typography className="font-semibold">Phone</Typography>
											</th>
											<th>
												<Typography className="font-semibold">Open sales</Typography>
											</th>
											<th>
												<Typography className="font-semibold">Balance</Typography>
											</th>
											<th>
												<Typography className="font-semibold">Store credit</Typography>
											</th>
											<th />
										</tr>
									</thead>
									<tbody>
										{customers.map((c: any) => (
											<tr key={c.customer_id}>
												<td>{c.customer_name || '—'}</td>
												<td>{c.customer_phone || '—'}</td>
												<td>{c.open_sales}</td>
												<td className="font-[tabular-nums]">
													{formatGhsCurrency(Number(c.balance_due) || 0, 2, 2)}
												</td>
												<td className="font-[tabular-nums]">
													{formatGhsCurrency(Number(c.store_credit_balance) || 0, 2, 2)}
												</td>
												<td>
													<Button
														size="small"
														onClick={() => {
															setCustomerFilter(c.customer_id);
															setMode('sales');
														}}
													>
														View sales
													</Button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)
					) : items.length === 0 ? (
						<Typography color="text.secondary">No outstanding sales.</Typography>
					) : (
						<div className="table-responsive border rounded-md">
							<table className="simple">
								<thead>
									<tr>
										<th>
											<Typography className="font-semibold">Invoice</Typography>
										</th>
										<th>
											<Typography className="font-semibold">Customer</Typography>
										</th>
										<th>
											<Typography className="font-semibold">Paid</Typography>
										</th>
										<th>
											<Typography className="font-semibold">Balance</Typography>
										</th>
										<th>
											<Typography className="font-semibold">Date</Typography>
										</th>
										<th />
									</tr>
								</thead>
								<tbody>
									{items.map((s: any) => (
										<tr key={s.id}>
											<td>#{s.invoice_number || s.id}</td>
											<td>{s.customer || '—'}</td>
											<td className="font-[tabular-nums]">
												{formatGhsCurrency(Number(s.amount_paid) || 0, 2, 2)}
											</td>
											<td className="font-[tabular-nums]">
												{formatGhsCurrency(Number(s.balance_due) || 0, 2, 2)}
											</td>
											<td>
												{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
											</td>
											<td>
												<Button
													size="small"
													component={Link}
													to={`/trading/sales/${s.id}`}
												>
													Open
												</Button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			}
			scroll={isMobile ? 'normal' : 'content'}
		/>
	);
}

export default OutstandingBalancesPage;
