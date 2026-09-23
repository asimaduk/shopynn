'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import { useMemo, useState } from 'react';
import ReturnsHeader from './ReturnsHeader';
import ReturnsTable from './ReturnsTable';
import { useGetReturnsQuery } from '../../TradingApi';
import FuseLoading from '@fuse/core/FuseLoading';
import type { SaleReturnRecord } from './returnsListData';

type DateRange = { startDate: string; endDate: string } | null;

export default function Returns() {
	const [dateRange, setDateRange] = useState<DateRange>(null);
	const { data, isLoading } = useGetReturnsQuery(
		dateRange
			? { startDate: dateRange.startDate, endDate: dateRange.endDate }
			: undefined
	);

	const rows: SaleReturnRecord[] = useMemo(() => {
		const list = Array.isArray(data) ? data : [];
		return list.map((r: any) => ({
			id: r.id,
			reference: r.reference_number || r.id,
			date: r.created_at ? String(r.created_at).slice(0, 10) : '',
			customer: r.customer_name || '—',
			originalSaleRef: r.sale_invoice_number || r.order_number || '—',
			amount: Number(r.total_amount || r.refund_amount || 0),
			status:
				String(r.status || '').toLowerCase() === 'completed'
					? 'approved'
					: String(r.status || '').toLowerCase() === 'draft'
						? 'pending'
						: String(r.status || '').toLowerCase() === 'cancelled'
							? 'rejected'
							: 'approved',
			items: []
		}));
	}, [data]);

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full h-full flex flex-col px-4">
				<ReturnsHeader
					totalCount={rows.length}
					dateRange={dateRange}
					onDateRangeChange={setDateRange}
				/>
				{isLoading ? <FuseLoading /> : <ReturnsTable data={rows} />}
			</div>
		</>
	);
}
