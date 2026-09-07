import Paper from '@mui/material/Paper';
import { lighten, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { memo, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { ApexOptions } from 'apexcharts';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseTab from 'src/components/tabs/FuseTab';
import FuseTabs from 'src/components/tabs/FuseTabs';
import { useProjectDashboardWidgets } from '../../../useProjectDashboardData';
import dynamic from 'next/dynamic';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

/**
 * Stock Movements Widget
 */
function StockMovementsWidget() {
	const { data: widgets, isLoading } = useProjectDashboardWidgets();
	const widget = widgets?.stockMovements;
	const overview = widget?.overview;
	const series = widget?.series;
	const labels = widget?.labels;
	const ranges = widget?.ranges;

	const [tabValue, setTabValue] = useState(0);
	const currentRange = Object.keys(ranges || {})[tabValue];
	const [awaitRender, setAwaitRender] = useState(true);
	const theme = useTheme();

	useEffect(() => {
		setAwaitRender(false);
	}, []);

	if (isLoading) {
		return <FuseLoading />;
	}

	if (!widget || !currentRange) {
		return null;
	}

	const chartOptions: ApexOptions = {
		chart: {
			fontFamily: 'inherit',
			foreColor: 'inherit',
			height: '100%',
			type: 'polarArea',
			toolbar: {
				show: false
			},
			zoom: {
				enabled: false
			}
		},
		labels,
		legend: {
			position: 'bottom'
		},
		plotOptions: {
			polarArea: {
				spokes: {
					connectorColors: theme.palette.divider
				},
				rings: {
					strokeColor: theme.palette.divider
				}
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
			width: 2
		},
		theme: {
			monochrome: {
				enabled: true,
				color: theme.palette.secondary.main,
				shadeIntensity: 0.75,
				shadeTo: 'dark'
			}
		},
		tooltip: {
			followCursor: true,
			theme: 'dark'
		},
		yaxis: {
			labels: {
				style: {
					colors: theme.palette.text.secondary
				}
			}
		}
	};

	if (awaitRender) {
		return null;
	}

	const currentOverview = overview?.[currentRange];

	return (
		<Paper className="flex flex-col flex-auto p-6 shadow-sm rounded-xl overflow-hidden h-full">
			<div className="flex flex-col sm:flex-row items-start justify-between">
				<Typography className="text-lg font-medium tracking-tight leading-6 truncate">
					Stock Movements
				</Typography>
				<div className="mt-0.75 sm:mt-0">
					<FuseTabs
						value={tabValue}
						onChange={(ev, value: number) => setTabValue(value)}
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
			<div className="flex flex-col flex-auto mt-1.5">
				<ReactApexChart
					className="flex-auto w-full"
					options={chartOptions}
					series={series?.[currentRange] || []}
					type={chartOptions?.chart?.type}
				/>
			</div>
			<Box
				sx={[
					(_theme) =>
						_theme.palette.mode === 'light'
							? {
									backgroundColor: lighten(theme.palette.background.default, 0.4)
								}
							: {
									backgroundColor: lighten(theme.palette.background.default, 0.02)
								}
				]}
				className="grid grid-cols-3 border-t divide-x -m-6 mt-4"
			>
				<div className="flex flex-col items-center justify-center p-6 sm:p-8">
					<div className="text-5xl font-semibold leading-none tracking-tighter">
						{currentOverview?.incoming}
					</div>
					<Typography className="mt-1 text-center text-secondary">Incoming</Typography>
				</div>
				<div className="flex flex-col items-center justify-center p-1.5 sm:p-2">
					<div className="text-5xl font-semibold leading-none tracking-tighter">
						{currentOverview?.outgoing}
					</div>
					<Typography className="mt-1 text-center text-secondary">Outgoing</Typography>
				</div>
				<div className="flex flex-col items-center justify-center p-1.5 sm:p-2">
					<div className="text-5xl font-semibold leading-none tracking-tighter">
						{currentOverview?.transfers}
					</div>
					<Typography className="mt-1 text-center text-secondary">Transfers</Typography>
				</div>
			</Box>
		</Paper>
	);
}

export default memo(StockMovementsWidget);
