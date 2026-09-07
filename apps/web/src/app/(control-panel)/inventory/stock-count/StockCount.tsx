'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import StockCountHeader from './StockCountHeader';
import StockCountTable from './StockCountTable';
import { useListStockCountsQuery } from './StockCountApi';
import type { ListStockCountsArg } from './StockCountApi';

type DateRange = { startDate: string; endDate: string } | null;

export default function StockCount() {
	const [dateRange, setDateRange] = useState<DateRange>(null);

	const queryArg = useMemo<ListStockCountsArg | undefined>(() => {
		if (!dateRange?.startDate || !dateRange?.endDate) return undefined;
		return {
			startDate: dateRange.startDate,
			endDate: dateRange.endDate
		};
	}, [dateRange]);

	const { data: records = [], isLoading, isFetching, error } = useListStockCountsQuery(queryArg);

	const busy = isLoading || isFetching;

	const { recordCount, productScopeTotal, completedCount } = useMemo(() => {
		const count = records.length;
		const scope = records.reduce((s, r) => s + Number(r.productCount ?? 0), 0);
		const done = records.filter((r) => r.status === 'completed').length;
		return { recordCount: count, productScopeTotal: scope, completedCount: done };
	}, [records]);

	return (
		<Box className="flex h-full w-full flex-col px-4">
			<StockCountHeader
				recordCount={recordCount}
				productScopeTotal={productScopeTotal}
				completedCount={completedCount}
				isLoading={busy}
				dateRange={dateRange}
				onDateRangeChange={setDateRange}
			/>
			<Box className="relative min-h-[240px] flex-1">
				{busy && (
					<Box
						className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60"
						aria-busy
					>
						<CircularProgress />
					</Box>
				)}
				{error ? (
					<Box className="text-secondary p-16 text-center text-sm">
						Could not load stock counts. Check your connection and try again.
					</Box>
				) : (
					<StockCountTable data={records} />
				)}
			</Box>
		</Box>
	);
}
