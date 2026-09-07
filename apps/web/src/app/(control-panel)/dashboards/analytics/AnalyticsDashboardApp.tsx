'use client';

import FusePageSimple from '@fuse/core/FusePageSimple';
import { styled } from '@mui/material/styles';
import * as React from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import AnalyticsDashboardAppHeader from './AnalyticsDashboardAppHeader';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import dynamic from 'next/dynamic';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from 'next/link';
import { ApexOptions } from 'apexcharts';
import { useGetDashboardQuery, useGetExpiringQuery, useGetLowStockQuery } from './MobileDashboardApi';
import { formatGhsCurrency } from './daily-sales/formatGhsCurrency';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const Root = styled(FusePageSimple)(({ theme }) => ({
	'& .FusePageSimple-header': {
		backgroundColor: theme.palette.background.paper,
		boxShadow: `inset 0 -1px 0 0px  ${theme.palette.divider}`
	}
}));

/**
 * Shopynn - Admin Dashboard
 */
function AnalyticsDashboardApp() {
	const { data: dash, isLoading } = useGetDashboardQuery({ recentLimit: 5 });
	const { data: lowStock = [], isFetching: lowStockLoading } = useGetLowStockQuery();
	const { data: expiring = [], isFetching: expiringLoading } = useGetExpiringQuery({ days: 30 });
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));

	if (isLoading && !dash) {
		return <FuseLoading />;
	}

	const totalSales = Number(dash?.sales?.totalRevenue ?? 0);
	const totalPurchases = Number(dash?.purchases?.totalAmount ?? 0);
	const totalExpenses = Number(dash?.expenses?.totalAmount ?? 0);
	const grossProfit = Number(dash?.profit?.grossProfit ?? 0);
	const netProfit = Number(dash?.profit?.net ?? 0);

	const stockValue = Number(dash?.stockValuation?.totalValue ?? 0);
	const activeProducts = Number(dash?.products?.activeProducts ?? 0);
	const avgValuePerProduct = Number(dash?.stockValuation?.averageValuePerProduct ?? 0);

	const highStock = Number(dash?.stockStatus?.highStockTotal ?? 0);
	const nearLow = Number(dash?.stockStatus?.nearLowTotal ?? 0);
	const low = Number(dash?.stockStatus?.lowStockTotal ?? 0);
	const lowStockPressurePct = activeProducts > 0 ? Math.min(100, ((nearLow + low) / activeProducts) * 100) : 0;
	const healthyStockPct = activeProducts > 0 ? Math.max(0, Math.min(100, (highStock / activeProducts) * 100)) : 0;
	const profitMarginPct = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
	const expenseToSalesPct = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;
	const totalCostBase = totalPurchases + totalExpenses;

	const last7 = Array.isArray(dash?.sales?.last7DaysByDay) ? dash.sales.last7DaysByDay : [];
	const chartCategories = last7.map((d: any) => {
		const dt = d?.date ? new Date(d.date) : null;
		if (!dt || Number.isNaN(dt.getTime())) return String(d?.label ?? '');
		return dt.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
	});
	const chartSeries = [
		{
			name: 'Sales',
			data: last7.map((d: any) => Number(d?.total ?? d?.value ?? 0))
		}
	];

	const chartOptions: ApexOptions = {
		chart: {
			fontFamily: 'inherit',
			foreColor: 'inherit',
			type: 'line',
			height: 280,
			toolbar: { show: false },
			zoom: { enabled: false }
		},
		stroke: { width: 3, curve: 'smooth' },
		dataLabels: { enabled: false },
		grid: { strokeDashArray: 4 },
		xaxis: { categories: chartCategories },
		yaxis: { labels: { formatter: (v) => `${Math.round(Number(v) || 0)}` } },
		tooltip: { shared: true, intersect: false }
	};

	return (
		<Root
			header={<AnalyticsDashboardAppHeader />}
			scroll={isMobile ? 'normal' : 'content'}
			content={
				<div className="w-full pt-4 sm:pt-6">
					<div className="w-full px-6 md:px-8 pb-10 space-y-6">
						{/* KPI cards */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<Paper className="p-5 rounded-xl shadow-sm border-l-4 border-green-500">
								<Box className="flex items-start justify-between gap-2">
									<Box>
										<Typography variant="caption" color="text.secondary">Total Sales</Typography>
										<Typography className="text-2xl font-semibold mt-1">{formatGhsCurrency(totalSales, 2, 2)}</Typography>
									</Box>
									<FuseSvgIcon size={18} color="success">heroicons-solid:arrow-trending-up</FuseSvgIcon>
								</Box>
								<Chip size="small" className="mt-3" color="success" label="Sales" />
							</Paper>
							<Paper className="p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
								<Typography variant="caption" color="text.secondary">Total Purchases</Typography>
								<Typography className="text-2xl font-semibold mt-1">{formatGhsCurrency(totalPurchases, 2, 2)}</Typography>
								<Chip size="small" className="mt-3" color="primary" label="Purchases" />
							</Paper>
							<Paper className="p-5 rounded-xl shadow-sm border-l-4 border-amber-500">
								<Typography variant="caption" color="text.secondary">Expenditures</Typography>
								<Typography className="text-2xl font-semibold mt-1">{formatGhsCurrency(totalExpenses, 2, 2)}</Typography>
								<Chip size="small" className="mt-3" color="warning" label="Expenses" />
							</Paper>
							<Paper className="p-5 rounded-xl shadow-sm border-l-4 border-slate-400">
								<Box className="flex items-start justify-between gap-2">
									<Box>
										<Typography variant="caption" color="text.secondary">Net profit</Typography>
										<Typography className="text-2xl font-semibold mt-1">{formatGhsCurrency(netProfit, 2, 2)}</Typography>
										<Typography variant="caption" color="text.secondary" className="block mt-1">
											Gross {formatGhsCurrency(grossProfit, 2, 2)} − expenses
										</Typography>
									</Box>
									<FuseSvgIcon size={18} color={netProfit >= 0 ? 'success' : 'error'}>
										{netProfit >= 0 ? 'heroicons-solid:arrow-trending-up' : 'heroicons-solid:arrow-trending-down'}
									</FuseSvgIcon>
								</Box>
								<Chip
									size="small"
									className="mt-3"
									variant={netProfit >= 0 ? 'filled' : 'outlined'}
									color={netProfit >= 0 ? 'success' : 'error'}
									label={netProfit >= 0 ? 'Healthy' : 'Needs attention'}
								/>
							</Paper>
						</div>

						{/* Sales chart */}
						<Paper className="p-5 rounded-xl shadow-sm">
							<Box className="flex items-center justify-between gap-3">
								<Box>
									<Typography className="text-lg font-semibold">Sales (last 7 days)</Typography>
									<Typography variant="body2" color="text.secondary">Trend overview</Typography>
								</Box>
								<Button
									component={Link}
									href="/dashboards/analytics/daily-sales"
									variant="text"
									endIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-right</FuseSvgIcon>}
								>
									View daily sales
								</Button>
							</Box>
							<Box className="mt-4">
								<ReactApexChart options={chartOptions} series={chartSeries as any} height={280} />
							</Box>
						</Paper>

						{/* Stock valuation + status */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<Paper className="p-5 rounded-xl shadow-sm">
								<Box className="flex items-center justify-between">
									<Box>
										<Typography className="text-lg font-semibold">Stock valuation</Typography>
										<Typography variant="body2" color="text.secondary">Inventory at cost (actual cost × qty)</Typography>
									</Box>
									<Chip size="small" color="primary" variant="outlined" label={`${activeProducts} products`} />
								</Box>
								<Typography className="text-3xl font-semibold mt-4">
									{formatGhsCurrency(stockValue, 2, 2)}
								</Typography>
								<Typography variant="body2" color="text.secondary" className="mt-2">
									Avg per product: {formatGhsCurrency(avgValuePerProduct, 2, 2)}
								</Typography>
							</Paper>

							<Paper className="p-5 rounded-xl shadow-sm">
								<Box className="flex items-center justify-between">
									<Box>
										<Typography className="text-lg font-semibold">Stock status</Typography>
										<Typography variant="body2" color="text.secondary">{activeProducts} active products</Typography>
									</Box>
									<Button component={Link} href="/inventory/products" variant="text">
										View inventory
									</Button>
								</Box>
								<Box className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
									<Box className="p-3 rounded-lg bg-green-50 border border-green-200">
										<Typography variant="caption" color="text.secondary">High stock</Typography>
										<Typography className="text-xl font-semibold">{highStock.toLocaleString()}</Typography>
									</Box>
									<Box className="p-3 rounded-lg bg-amber-50 border border-amber-200">
										<Typography variant="caption" color="text.secondary">Near low</Typography>
										<Typography className="text-xl font-semibold">{nearLow.toLocaleString()}</Typography>
									</Box>
									<Box className="p-3 rounded-lg bg-red-50 border border-red-200">
										<Typography variant="caption" color="text.secondary">Low stock</Typography>
										<Typography className="text-xl font-semibold">{low.toLocaleString()}</Typography>
									</Box>
								</Box>
							</Paper>
						</div>

						{/* Low stock + expiring soon */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<Paper className="p-5 rounded-xl shadow-sm">
								<Box className="flex items-center justify-between">
									<Box>
										<Typography className="text-lg font-semibold">Items to reorder</Typography>
										<Typography variant="body2" color="text.secondary">
											{lowStockLoading ? 'Loading…' : `${lowStock.length} below reorder point`}
										</Typography>
									</Box>
									<Button component={Link} href="/inventory/reorder" variant="text">
										View all
									</Button>
								</Box>
								<Divider className="my-4" />
								{lowStock.slice(0, 4).map((item: any) => (
									<Box key={String(item?.id ?? item?.sku ?? item?.name)} className="flex items-center justify-between py-2">
										<Box className="min-w-0">
											<Typography className="font-medium truncate">{item?.name ?? '—'}</Typography>
											<Typography variant="body2" color="text.secondary" className="truncate">
												{[item?.sku, item?.current ? `Stock: ${item.current}` : null, item?.reorderAt ? `Reorder at ${item.reorderAt}` : null]
													.filter(Boolean)
													.join(' · ')}
											</Typography>
										</Box>
										<FuseSvgIcon size={18} color="action">heroicons-outline:chevron-right</FuseSvgIcon>
									</Box>
								))}
								{!lowStockLoading && lowStock.length === 0 && (
									<Typography variant="body2" color="text.secondary">No items below reorder point.</Typography>
								)}
							</Paper>

							<Paper className="p-5 rounded-xl shadow-sm">
								<Box className="flex items-center justify-between">
									<Box>
										<Typography className="text-lg font-semibold">Expiring soon</Typography>
										<Typography variant="body2" color="text.secondary">
											{expiringLoading ? 'Loading…' : `${expiring.length} in next 30 days`}
										</Typography>
									</Box>
									<Button component={Link} href="/inventory/expiring" variant="text">
										View all
									</Button>
								</Box>
								<Divider className="my-4" />
								{expiring.slice(0, 4).map((item: any) => (
									<Box key={String(item?.id ?? item?.sku ?? item?.name)} className="flex items-center justify-between py-2">
										<Box className="min-w-0">
											<Typography className="font-medium truncate">{item?.name ?? '—'}</Typography>
											<Typography variant="body2" color="text.secondary" className="truncate">
												{[item?.sku, item?.expiryDate ? `Expires ${item.expiryDate}` : null, typeof item?.daysLeft === 'number' ? `${item.daysLeft}d` : null]
													.filter(Boolean)
													.join(' · ')}
											</Typography>
										</Box>
										<FuseSvgIcon size={18} color="action">heroicons-outline:chevron-right</FuseSvgIcon>
									</Box>
								))}
								{!expiringLoading && expiring.length === 0 && (
									<Typography variant="body2" color="text.secondary">No products expiring soon.</Typography>
								)}
							</Paper>
						</div>
						{/* Performance snapshot */}
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
							<Paper className="p-5 rounded-xl shadow-sm">
								<Box className="flex items-center justify-between">
									<Typography className="text-base font-semibold">Profitability</Typography>
									<Chip
										size="small"
										color={profitMarginPct >= 20 ? 'success' : profitMarginPct >= 10 ? 'warning' : 'error'}
										label={`${profitMarginPct.toFixed(1)}%`}
									/>
								</Box>
								<Typography variant="body2" color="text.secondary" className="mt-3">
									Net margin (gross profit minus expenses) vs total sales revenue.
								</Typography>
								<LinearProgress
									variant="determinate"
									value={Math.max(0, Math.min(100, profitMarginPct))}
									color={profitMarginPct >= 20 ? 'success' : profitMarginPct >= 10 ? 'warning' : 'error'}
									className="mt-4 h-8 rounded-full"
								/>
							</Paper>
							<Paper className="p-5 rounded-xl shadow-sm">
								<Box className="flex items-center justify-between">
									<Typography className="text-base font-semibold">Inventory health</Typography>
									<Chip
										size="small"
										color={lowStockPressurePct <= 20 ? 'success' : lowStockPressurePct <= 40 ? 'warning' : 'error'}
										label={`${(100 - lowStockPressurePct).toFixed(0)}% healthy`}
									/>
								</Box>
								<Typography variant="body2" color="text.secondary" className="mt-3">
									Share of products not under near-low or low pressure.
								</Typography>
								<LinearProgress
									variant="determinate"
									value={Math.max(0, Math.min(100, healthyStockPct))}
									color={healthyStockPct >= 60 ? 'success' : healthyStockPct >= 40 ? 'warning' : 'error'}
									className="mt-4 h-8 rounded-full"
								/>
							</Paper>
							<Paper className="p-5 rounded-xl shadow-sm">
								<Box className="flex items-center justify-between">
									<Typography className="text-base font-semibold">Cost efficiency</Typography>
									<Chip
										size="small"
										color={expenseToSalesPct <= 20 ? 'success' : expenseToSalesPct <= 35 ? 'warning' : 'error'}
										label={`${expenseToSalesPct.toFixed(1)}% expense ratio`}
									/>
								</Box>
								<Typography variant="body2" color="text.secondary" className="mt-3">
									Operational expenses compared to total sales.
								</Typography>
								<Typography className="text-xl font-semibold mt-4">
									{formatGhsCurrency(totalCostBase, 2, 2)}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									Purchases + expenditures combined
								</Typography>
							</Paper>
						</div>
					</div>
				</div>
			}
		/>
	);
}

export default AnalyticsDashboardApp;
