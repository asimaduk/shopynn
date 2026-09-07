import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { memo } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import { useProjectDashboardWidgets } from '../../../useProjectDashboardData';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';

/**
 * Top Products Widget - Shows top selling products
 */
function TopProductsWidget() {
	const { data: widgets, isLoading } = useProjectDashboardWidgets();
	const widget = widgets?.topProducts;
	const products = widget?.products;

	if (isLoading) {
		return <FuseLoading />;
	}

	if (!widget || !products) {
		return null;
	}

	return (
		<Paper className="flex flex-col flex-auto p-6 shadow-sm rounded-xl overflow-hidden">
			<Typography className="text-lg font-medium tracking-tight leading-6 mb-4">
				{widget.title}
			</Typography>
			<div className="flex flex-col gap-4">
				{products.slice(0, 5).map((product) => (
					<div
						key={product.id}
						className="flex items-center justify-between p-3 rounded-lg hover:bg-hover transition-colors"
					>
						<div className="flex items-center gap-3 flex-1 min-w-0">
							<Avatar
								src={product.image}
								alt={product.name}
								variant="rounded"
								className="w-12 h-12"
							>
								{product.name[0]}
							</Avatar>
							<div className="flex flex-col min-w-0 flex-1">
								<Typography className="font-medium truncate">{product.name}</Typography>
								<Typography
									variant="caption"
									color="text.secondary"
								>
									{product.sales} sales
								</Typography>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Chip
								label={`${product.quantity} units`}
								size="small"
								color="primary"
								variant="outlined"
							/>
							<Typography className="font-semibold text-green-600 min-w-[80px] text-right">
								{product.revenue.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD',
									maximumFractionDigits: 0
								})}
							</Typography>
						</div>
					</div>
				))}
			</div>
		</Paper>
	);
}

export default memo(TopProductsWidget);
