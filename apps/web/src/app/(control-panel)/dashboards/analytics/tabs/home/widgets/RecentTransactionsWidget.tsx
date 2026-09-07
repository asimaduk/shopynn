import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { memo } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import { useProjectDashboardWidgets } from '../../../useProjectDashboardData';
import Chip from '@mui/material/Chip';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';

/**
 * Recent Transactions Widget
 */
function RecentTransactionsWidget() {
	const { data: widgets, isLoading } = useProjectDashboardWidgets();
	const widget = widgets?.recentTransactions;
	const transactions = widget?.transactions;

	if (isLoading) {
		return <FuseLoading />;
	}

	if (!widget || !transactions) {
		return null;
	}

	const getTypeColor = (type: string) => {
		switch (type) {
			case 'sale':
				return 'success';
			case 'purchase':
				return 'primary';
			case 'transfer':
				return 'warning';
			case 'adjustment':
				return 'error';
			default:
				return 'default';
		}
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case 'sale':
				return 'heroicons-outline:arrow-trending-down';
			case 'purchase':
				return 'heroicons-outline:arrow-trending-up';
			case 'transfer':
				return 'heroicons-outline:arrow-right-left';
			case 'adjustment':
				return 'heroicons-outline:adjustments-vertical';
			default:
				return 'heroicons-outline:information-circle';
		}
	};

	return (
		<Paper className="flex flex-col flex-auto p-6 shadow-sm rounded-xl overflow-hidden">
			<Typography className="text-lg font-medium tracking-tight leading-6 mb-4">
				{widget.title}
			</Typography>
			<div className="flex flex-col gap-3">
				{transactions.slice(0, 5).map((transaction) => (
					<div
						key={transaction.id}
						className="flex items-center justify-between p-3 rounded-lg hover:bg-hover transition-colors"
					>
						<div className="flex items-center gap-3 flex-1 min-w-0">
							<Chip
								icon={
									<FuseSvgIcon size={16}>
										{getTypeIcon(transaction.type)}
									</FuseSvgIcon>
								}
								label={transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
								size="small"
								color={getTypeColor(transaction.type) as any}
								variant="outlined"
							/>
							<div className="flex flex-col min-w-0 flex-1">
								<Typography className="font-medium truncate">{transaction.product}</Typography>
								<Typography
									variant="caption"
									color="text.secondary"
								>
									{transaction.warehouse && `${transaction.warehouse} • `}
									{format(new Date(transaction.date), 'MMM dd, yyyy HH:mm')}
								</Typography>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Typography
								className={`font-semibold ${
									transaction.type === 'sale' ? 'text-green-600' : 'text-blue-600'
								}`}
							>
								{transaction.quantity > 0 ? '+' : ''}
								{transaction.quantity}
							</Typography>
							{transaction.amount > 0 && (
								<Typography className="font-semibold text-right min-w-[80px]">
									{transaction.amount.toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD',
										maximumFractionDigits: 0
									})}
								</Typography>
							)}
						</div>
					</div>
				))}
			</div>
		</Paper>
	);
}

export default memo(RecentTransactionsWidget);
