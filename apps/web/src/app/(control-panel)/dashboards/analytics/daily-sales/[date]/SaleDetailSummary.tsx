'use client';

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { DailySaleRow } from '../dailySalesListData';
import { formatGhsCurrency } from '../formatGhsCurrency';

type SaleDetailSummaryProps = {
	day: DailySaleRow;
};

export default function SaleDetailSummary({ day }: SaleDetailSummaryProps) {
	return (
		<Paper className="p-4 shadow-sm rounded-xl mb-6">
			<Typography variant="subtitle2" color="text.secondary" className="mb-3 font-medium">
				Day summary
			</Typography>
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<div className="flex flex-col py-3">
					<Typography variant="caption" color="text.secondary">
						Sales
					</Typography>
					<Typography className="text-xl font-semibold">{day.sales}</Typography>
				</div>
				<div className="flex flex-col py-3">
					<Typography variant="caption" color="text.secondary">
						Revenue
					</Typography>
					<Typography className="text-xl font-semibold">
						{formatGhsCurrency(day.revenue, 0)}
					</Typography>
				</div>
				<div className="flex flex-col py-3">
					<Typography variant="caption" color="text.secondary">
						Transactions
					</Typography>
					<Typography className="text-xl font-semibold">{day.transactions}</Typography>
				</div>
				<div className="flex flex-col py-3">
					<Typography variant="caption" color="text.secondary">
						Avg order
					</Typography>
					<Typography className="text-xl font-semibold">
						{formatGhsCurrency(day.averageOrder, 0)}
					</Typography>
				</div>
			</div>
		</Paper>
	);
}
