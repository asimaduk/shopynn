import Paper from '@mui/material/Paper';
import { lighten, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { memo, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { ApexOptions } from 'apexcharts';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import _ from 'lodash';
import Link from 'next/link';
import FuseTabs from 'src/components/tabs/FuseTabs';
import FuseTab from 'src/components/tabs/FuseTab';
import { useProjectDashboardWidgets } from '../../../useProjectDashboardData';
import dynamic from 'next/dynamic';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

/**
 * Sales Summary Widget
 */
function SalesSummaryWidget() {
	const theme = useTheme();
	const [awaitRender, setAwaitRender] = useState(true);
	const [tabValue, setTabValue] = useState(0);
	const { data: widgets, isLoading } = useProjectDashboardWidgets();
	const widget = widgets?.salesSummary;
	const overview = widget?.overview;
	const series = widget?.series;
	const ranges = widget?.ranges;
	const labels = widget?.labels;
	const currentRange = Object.keys(ranges || {})[tabValue];

	const chartOptions: ApexOptions = {
		chart: {
			fontFamily: 'inherit',
			foreColor: 'inherit',
			height: '100%',
			type: 'line',
			toolbar: {
				show: false
			},
			zoom: {
				enabled: false
			}
		},
		colors: [theme.palette.primary.main, theme.palette.secondary.main],
		labels,
		dataLabels: {
			enabled: true,
			enabledOnSeries: [0],
			background: {
				borderWidth: 0
			}
		},
		grid: {
			borderColor: theme.palette.divider
		},
		legend: {
			show: false
		},
		plotOptions: {
			bar: {
				columnWidth: '50%'
			}
		},
		states: {
			hover: {
				filter: {
					type: 'darken'
				}
			}
		},
		stroke: {
			width: [3, 0]
		},
		tooltip: {
			followCursor: true,
			theme: theme.palette.mode
		},
		xaxis: {
			axisBorder: {
				show: false
			},
			axisTicks: {
				color: theme.palette.divider
			},
			labels: {
				style: {
					colors: theme.palette.text.secondary
				}
			},
			tooltip: {
				enabled: false
			}
		},
		yaxis: {
			labels: {
				offsetX: -16,
				style: {
					colors: theme.palette.text.secondary
				}
			}
		}
	};

	useEffect(() => {
		setAwaitRender(false);
	}, []);

	if (isLoading) {
		return <FuseLoading />;
	}

	if (!widget || !currentRange) {
		return null;
	}

	if (awaitRender) {
		return null;
	}

	const currentOverview = overview?.[currentRange];

	return (
		<Paper className="flex flex-col flex-auto p-6 shadow-sm rounded-xl overflow-hidden">
			<div className="flex flex-col sm:flex-row items-start justify-between">
				<Typography className="text-xl font-medium tracking-tight leading-6 truncate">
					Sales Summary
				</Typography>
				<div className="mt-3 sm:mt-0">
					<FuseTabs
						value={tabValue}
						onChange={(_ev, value: number) => setTabValue(value)}
					>
						{Object.entries(ranges).map(([key, label], index) => (
							<FuseTab
								key={key}
								value={index}
								label={label}
							/>
						))}
					</FuseTabs>
				</div>
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6 w-full mt-8 sm:mt-4">
				<div className="flex flex-col flex-auto">
					<Typography
						className="font-medium"
						color="text.secondary"
					>
						Sales & Revenue
					</Typography>
					<div className="flex flex-col flex-auto">
						<ReactApexChart
							className="flex-auto w-full"
							options={chartOptions}
							series={_.cloneDeep(series?.[currentRange] || [])}
							height={320}
						/>
					</div>
				</div>
				<div className="flex flex-col">
					<Typography
						className="font-medium"
						color="text.secondary"
					>
						Overview
					</Typography>
					<div className="flex-auto grid grid-cols-2 gap-4 mt-6">
						<div className="col-span-2 flex flex-col items-center justify-center py-8 px-1 rounded-xl bg-green-50 text-green-800">
							<Typography className="text-5xl sm:text-7xl font-semibold leading-none tracking-tight">
								{currentOverview?.totalSales}
							</Typography>
							<Typography className="mt-1 text-sm sm:text-lg font-medium">Total Sales</Typography>
						</div>
						<div className="col-span-2 flex flex-col items-center justify-center py-8 px-1 rounded-xl bg-blue-50 text-blue-800">
							<Typography className="text-5xl sm:text-7xl font-semibold leading-none tracking-tight">
								{currentOverview?.totalRevenue?.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD',
									maximumFractionDigits: 0
								})}
							</Typography>
							<Typography className="mt-1 text-sm sm:text-lg font-medium">Total Revenue</Typography>
						</div>
						<Box
							sx={[
								(_theme) =>
									_theme.palette.mode === 'light'
										? {
												backgroundColor: lighten(_theme.palette.background.default, 0.4)
											}
										: {
												backgroundColor: lighten(_theme.palette.background.default, 0.02)
											}
							]}
							className="col-span-1 flex flex-col items-center justify-center py-8 px-1 rounded-xl"
						>
							<Typography className="text-5xl font-semibold leading-none tracking-tight">
								{currentOverview?.averageOrder?.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD',
									maximumFractionDigits: 0
								})}
							</Typography>
							<Typography className="mt-1 text-sm font-medium text-center">Avg Order</Typography>
						</Box>
						<Box
							sx={[
								(theme) =>
									theme.palette.mode === 'light'
										? {
												backgroundColor: lighten(theme.palette.background.default, 0.4)
											}
										: {
												backgroundColor: lighten(theme.palette.background.default, 0.02)
											}
							]}
							className="col-span-1 flex flex-col items-center justify-center py-8 px-1 rounded-xl"
						>
							<Typography className="text-5xl font-semibold leading-none tracking-tight">
								{currentOverview?.transactions}
							</Typography>
							<Typography className="mt-1 text-sm font-medium text-center">Transactions</Typography>
						</Box>
					</div>
				</div>
			</div>
			<Link
				href="/dashboards/analytics/daily-sales"
				className="mt-4 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
			>
				View all
				<FuseSvgIcon size={16}>heroicons-outline:arrow-right</FuseSvgIcon>
			</Link>
		</Paper>
	);
}

export default memo(SalesSummaryWidget);
