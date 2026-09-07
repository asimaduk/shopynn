'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import SaleDetailHeader from './SaleDetailHeader';
import SaleDetailSummary from './SaleDetailSummary';
import SaleDetailTable from './SaleDetailTable';
import { useGetSalesByDateQuery } from '../DailySalesApi';
import type { DailySaleRow } from '../dailySalesListData';
import type { SaleDetailLine } from '../dailySalesListData';

function buildDayFromLines(date: string, lines: SaleDetailLine[]): DailySaleRow {
	const revenue = lines.reduce((s, l) => s + l.amount, 0);
	const transactions = lines.length;
	return {
		id: date,
		date,
		sales: transactions,
		revenue,
		transactions,
		averageOrder: transactions > 0 ? revenue / transactions : 0
	};
}

export default function SaleDetail() {
	const params = useParams();
	const date = typeof params?.date === 'string' ? params.date : null;

	const { data: details = [], isLoading, error } = useGetSalesByDateQuery(
		{ date: date! },
		{ skip: !date }
	);

	const day = useMemo(() => {
		if (!date) return null;
		return buildDayFromLines(date, details);
	}, [date, details]);

	const formattedDate = date
		? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			})
		: '';

	if (!date) {
		return (
			<div className="flex w-full flex-col px-4 py-8">
				<p className="text-secondary">Invalid date.</p>
				<Link to="/dashboards/analytics/daily-sales" className="text-primary mt-2 underline">
					Back to daily sales
				</Link>
			</div>
		);
	}

	if (isLoading) {
		return (
			<Box className="flex w-full flex-col items-center justify-center px-4 py-24">
				<CircularProgress />
			</Box>
		);
	}

	if (error) {
		return (
			<div className="flex w-full flex-col px-4 py-8">
				<Typography color="error" className="text-sm">
					Could not load sales for this date.
				</Typography>
				<Link to="/dashboards/analytics/daily-sales" className="text-primary mt-2 underline">
					Back to daily sales
				</Link>
			</div>
		);
	}

	if (!day) {
		return null;
	}

	return (
		<div className="flex h-full w-full min-w-0 max-w-full flex-col px-4">
			<SaleDetailHeader date={date} formattedDate={formattedDate} />
			<SaleDetailSummary day={day} />
			<div className="min-w-0 max-w-full overflow-x-auto">
				<SaleDetailTable data={details} />
			</div>
		</div>
	);
}
