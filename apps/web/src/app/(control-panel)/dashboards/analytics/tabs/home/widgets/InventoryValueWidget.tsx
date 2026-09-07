import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { memo } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import FuseLoading from '@fuse/core/FuseLoading';
import { useProjectDashboardWidgets } from '../../../useProjectDashboardData';

/**
 * Inventory Value Widget - Shows total inventory value
 */
function InventoryValueWidget() {
	const { data: widgets, isLoading } = useProjectDashboardWidgets();
	const widget = widgets?.inventoryValue;

	if (isLoading) {
		return <FuseLoading />;
	}

	if (!widget) {
		return null;
	}

	const { data, title } = widget;

	return (
		<Paper className="flex flex-col flex-auto shadow-sm rounded-xl overflow-hidden">
			<div className="flex items-center justify-between px-2 pt-2">
				<Typography
					className="px-3 text-lg font-medium tracking-tight leading-6 truncate"
					color="text.secondary"
				>
					{title}
				</Typography>
				<IconButton aria-label="more">
					<FuseSvgIcon>heroicons-outline:ellipsis-vertical</FuseSvgIcon>
				</IconButton>
			</div>
			<div className="text-center mt-4">
				<Typography className="text-5xl sm:text-6xl font-bold tracking-tight leading-none text-green-500">
					{data?.value.toLocaleString('en-US', {
						style: 'currency',
						currency: 'USD',
						maximumFractionDigits: 0
					})}
				</Typography>
				<Typography className="text-lg font-medium text-green-600">{data?.name}</Typography>
			</div>
			<Typography
				className="flex items-baseline justify-center w-full mt-5 mb-6 space-x-2"
				color="text.secondary"
			>
				<span className="truncate">{data?.extra.name}:</span>
				<b>
					{data?.extra.value.toLocaleString('en-US', {
						style: 'currency',
						currency: 'USD',
						maximumFractionDigits: 0
					})}
				</b>
			</Typography>
		</Paper>
	);
}

export default memo(InventoryValueWidget);
