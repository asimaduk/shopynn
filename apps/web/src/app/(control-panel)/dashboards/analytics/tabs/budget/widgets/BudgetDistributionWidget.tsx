import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { memo } from 'react';
import { ApexOptions } from 'apexcharts';
import FuseLoading from '@fuse/core/FuseLoading';
import _ from 'lodash';
import BudgetDistributionDataType from './types/BudgetDistributionDataType';
import { useProjectDashboardWidgets } from '../../../useProjectDashboardData';
import dynamic from 'next/dynamic';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

/**
 * The BudgetDistributionWidget widget.
 */
function BudgetDistributionWidget() {
	const { data: widgets, isLoading } = useProjectDashboardWidgets();
	const widget = widgets?.budgetDistribution as BudgetDistributionDataType;
	const categories = widget?.categories;
	const series = widget?.series;
	const theme = useTheme();

	const chartOptions: ApexOptions = {
		chart: {
			fontFamily: 'inherit',
			foreColor: 'inherit',
			height: '100%',
			type: 'radar',
			sparkline: {
				enabled: true
			}
		},
		colors: [theme.palette.secondary.main],
		dataLabels: {
			enabled: true,
			formatter: (val: string) => `${val}%`,
			textAnchor: 'start',
			style: {
				fontSize: '13px',
				fontWeight: 500
			},
			background: {
				borderWidth: 0,
				padding: 4
			},
			offsetY: -15
		},
		markers: {
			strokeColors: theme.palette.primary.main,
			strokeWidth: 4
		},
		plotOptions: {
			radar: {
				polygons: {
					strokeColors: theme.palette.divider,
					connectorColors: theme.palette.divider
				}
			}
		},
		stroke: {
			width: 2
		},
		tooltip: {
			theme: 'dark',
			y: {
				formatter: (val) => `${val}%`
			}
		},
		xaxis: {
			labels: {
				show: true,
				style: {
					fontSize: '12px',
					fontWeight: '500'
				}
			},
			categories
		},
		yaxis: {
			max: (max) => parseInt((max + 10).toFixed(0), 10),
			tickAmount: 7
		}
	};

	if (isLoading) {
		return <FuseLoading />;
	}

	if (!widget) {
		return null;
	}

	return (
		<Paper className="flex flex-col flex-auto p-6 shadow-sm rounded-xl overflow-hidden h-full">
			<Typography className="text-lg font-medium tracking-tight leading-6 truncate">
				Budget Distribution
			</Typography>

			<div className="flex flex-col flex-auto">
				<ReactApexChart
					className="flex-auto w-full h-80"
					options={chartOptions}
					series={_.cloneDeep(series)}
					type={chartOptions?.chart?.type}
					height={chartOptions?.chart?.height}
				/>
			</div>
		</Paper>
	);
}

export default memo(BudgetDistributionWidget);
