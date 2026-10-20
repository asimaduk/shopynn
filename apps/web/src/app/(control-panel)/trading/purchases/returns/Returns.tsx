'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import { useMemo, useState } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import ReturnsHeader from './ReturnsHeader';
import ReturnsTable from './ReturnsTable';
import { useGetReturnsQuery } from '../../TradingApi';
import { toPurchaseReturnRecord, type PurchaseReturnRecord } from './returnsListData';

type DateRange = { startDate: string; endDate: string } | null;

export default function Returns() {
	const [dateRange, setDateRange] = useState<DateRange>(null);
	const { data, isLoading } = useGetReturnsQuery(
		dateRange
			? { type: 'purchase', startDate: dateRange.startDate, endDate: dateRange.endDate }
			: { type: 'purchase' }
	);

	const rows: PurchaseReturnRecord[] = useMemo(
		() => (Array.isArray(data) ? data.map(toPurchaseReturnRecord) : []),
		[data]
	);

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
