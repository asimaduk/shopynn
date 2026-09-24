'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission } from '@auth/permissions';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { getVisibleReportSections, ReportNavItem, ReportSection } from './reportSections';
import { useLazyGetAccountantPackQuery } from './ReportsApi';

function downloadCsvFile(filename: string, content: string) {
	const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function ReportRowLink(props: { report: ReportNavItem; sectionColor: string }) {
	const { report, sectionColor } = props;
	const theme = useTheme();
	const href = report.href || `/reports/${report.id}`;

	return (
		<Link href={href} className="block no-underline text-inherit">
			<Box
				className="flex items-center gap-3 px-3 sm:px-4 py-2.5 transition-colors"
				sx={{
					borderLeft: `3px solid ${sectionColor}`,
					'&:hover': {
						bgcolor:
							theme.palette.mode === 'dark'
								? alpha(theme.palette.common.white, 0.06)
								: alpha(theme.palette.common.black, 0.04)
					}
				}}
			>
				<Box
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
					sx={{ bgcolor: alpha(sectionColor, theme.palette.mode === 'dark' ? 0.18 : 0.1) }}
				>
					<FuseSvgIcon sx={{ color: sectionColor }} size={20}>
						{report.icon}
					</FuseSvgIcon>
				</Box>
				<Box className="min-w-0 flex-1">
					<Typography className="font-semibold leading-snug truncate" variant="body2">
						{report.title}
					</Typography>
					<Typography className="text-secondary text-xs leading-snug truncate mt-0.5">
						{report.description}
					</Typography>
				</Box>
				<FuseSvgIcon className="text-secondary shrink-0 opacity-60" size={18}>
					heroicons-outline:chevron-right
				</FuseSvgIcon>
			</Box>
		</Link>
	);
}

export default function ReportsListPage() {
	const theme = useTheme();
	const { data: user } = useUser();
	const [searchQuery, setSearchQuery] = useState('');
	const [category, setCategory] = useState<string>('all');
	const [fetchAccountantPack, { isFetching: packing }] = useLazyGetAccountantPackQuery();

	const canAccountantPack = hasFeatureAndPermission(user, 'reports.export', undefined, 'reports.export');

	const handleAccountantPack = async () => {
		const end = new Date();
		const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		try {
			const res = await fetchAccountantPack({
				startDate: start.toISOString(),
				endDate: end.toISOString()
			}).unwrap();
			const files = res?.files || [];
			if (!files.length) {
				toast.error('No files returned.');
				return;
			}
			for (const f of files) {
				downloadCsvFile(f.filename, f.content);
			}
			const c = res.counts;
			toast.success(
				`Downloaded sales (${c?.sales ?? 0}), purchases (${c?.purchases ?? 0}), expenses (${c?.expenses ?? 0}).`
			);
		} catch (e: any) {
			toast.error(e?.data?.message || e?.message || 'Could not build accountant pack.');
		}
	};

	const visibleSections = useMemo(() => getVisibleReportSections(user), [user]);

	const filteredSections = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		let sections = visibleSections;
		if (category !== 'all') {
			sections = sections.filter((s) => s.title === category);
		}
		if (!q) return sections;
		return sections
			.map((section) => {
				const reports = section.reports.filter(
					(r) =>
						r.title.toLowerCase().includes(q) ||
						r.description.toLowerCase().includes(q) ||
						section.title.toLowerCase().includes(q)
				);
				return reports.length ? { ...section, reports } : null;
			})
			.filter(Boolean) as ReportSection[];
	}, [searchQuery, visibleSections, category]);

	const totalReports = useMemo(
		() => filteredSections.reduce((n, s) => n + s.reports.length, 0),
		[filteredSections]
	);

	const totalAll = useMemo(
		() => visibleSections.reduce((n, s) => n + s.reports.length, 0),
		[visibleSections]
	);

	return (
		<PlanFeatureGate
			requiredPermissions={['reports.view']}
			requiredFeatures={['reports.view']}
			featureTitle="Reports"
			backHref="/dashboards/analytics"
		>
			<Box className="w-full h-full flex flex-col px-4 pb-12">
				{/* Header — same pattern as Sales / Purchases list pages */}
				<div className="flex grow-0 flex-1 w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-6 sm:py-8">
					<motion.span
						initial={{ x: -20 }}
						animate={{ x: 0, transition: { delay: 0.2 } }}
					>
						<div>
							<PageBreadcrumb className="mb-2" />
							<Typography className="text-4xl font-extrabold leading-none tracking-tight">
								Reports
							</Typography>
							<Typography variant="body1" color="text.secondary" className="mt-1 font-medium">
								{totalAll} {totalAll === 1 ? 'report' : 'reports'}
								<span className="mx-2 opacity-50">·</span>
								Inventory, sales, purchases, operations, financials
							</Typography>
						</div>
					</motion.span>
					{canAccountantPack ? (
						<Button
							variant="contained"
							color="secondary"
							size="medium"
							disabled={packing}
							onClick={() => void handleAccountantPack()}
							startIcon={
								packing ? (
									<CircularProgress size={16} color="inherit" />
								) : (
									<FuseSvgIcon size={18}>heroicons-outline:arrow-down-tray</FuseSvgIcon>
								)
							}
							sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0, alignSelf: 'flex-start' }}
						>
							Download for accountant
						</Button>
					) : null}
				</div>

				{/* Search */}
				<TextField
					className="w-full mb-3"
					size="small"
					placeholder="Search reports…"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					autoComplete="off"
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<FuseSvgIcon size={18} color="action">
									heroicons-outline:magnifying-glass
								</FuseSvgIcon>
							</InputAdornment>
						),
						endAdornment: searchQuery ? (
							<InputAdornment position="end">
								<IconButton
									size="small"
									aria-label="Clear search"
									onClick={() => setSearchQuery('')}
									edge="end"
								>
									<FuseSvgIcon size={16}>heroicons-outline:x-mark</FuseSvgIcon>
								</IconButton>
							</InputAdornment>
						) : null
					}}
				/>

				{/* Category chips */}
				<Box className="flex flex-wrap gap-1.5 mb-5">
					<Chip
						size="small"
						label={`All (${totalAll})`}
						clickable
						variant={category === 'all' ? 'filled' : 'outlined'}
						color={category === 'all' ? 'primary' : 'default'}
						onClick={() => setCategory('all')}
						sx={{ fontWeight: 600 }}
					/>
					{visibleSections.map((section) => (
						<Chip
							key={section.title}
							size="small"
							label={`${section.title} (${section.reports.length})`}
							clickable
							variant={category === section.title ? 'filled' : 'outlined'}
							onClick={() => setCategory(section.title)}
							sx={{
								fontWeight: 600,
								...(category === section.title
									? {
											bgcolor: alpha(section.color, 0.15),
											color: 'text.primary',
											borderColor: alpha(section.color, 0.4),
											'&:hover': { bgcolor: alpha(section.color, 0.22) }
										}
									: {})
							}}
						/>
					))}
				</Box>

				{/* Slim rows by section */}
				<Box className="flex flex-col gap-5">
					{filteredSections.map((section) => (
						<Box key={section.title}>
							<Box className="flex items-center gap-2 mb-1.5 px-0.5">
								<Box
									className="h-1.5 w-1.5 rounded-full shrink-0"
									sx={{ bgcolor: section.color }}
								/>
								<Typography
									variant="caption"
									className="font-bold uppercase tracking-wider"
									sx={{ color: 'text.secondary', letterSpacing: '0.05em' }}
								>
									{section.title}
								</Typography>
								<Typography variant="caption" className="text-secondary tabular-nums ml-auto">
									{section.reports.length}
								</Typography>
							</Box>
							<Paper
								elevation={0}
								className="overflow-hidden"
								sx={{
									border: `1px solid ${theme.palette.divider}`,
									borderRadius: 1.5,
									'& > a + a': {
										borderTop: `1px solid ${theme.palette.divider}`
									}
								}}
							>
								{section.reports.map((report) => (
									<ReportRowLink key={report.id} report={report} sectionColor={section.color} />
								))}
							</Paper>
						</Box>
					))}
				</Box>

				{filteredSections.length === 0 && (
					<Paper
						elevation={0}
						className="mt-2 rounded-xl border border-dashed"
						sx={{ borderColor: 'divider' }}
					>
						<Box className="flex flex-col items-center justify-center py-12 px-6 text-center">
							<FuseSvgIcon size={28} sx={{ color: 'text.secondary', opacity: 0.6, mb: 1.5 }}>
								heroicons-outline:magnifying-glass
							</FuseSvgIcon>
							<Typography variant="subtitle1" className="font-semibold">
								No reports match
							</Typography>
							<Typography className="text-secondary text-sm mt-1 max-w-xs">
								Try another keyword or clear filters.
							</Typography>
							{(searchQuery.trim() !== '' || category !== 'all') && (
								<Button
									className="mt-4"
									size="small"
									variant="outlined"
									onClick={() => {
										setSearchQuery('');
										setCategory('all');
									}}
									sx={{ textTransform: 'none' }}
								>
									Clear filters
								</Button>
							)}
						</Box>
					</Paper>
				)}

				{filteredSections.length > 0 && searchQuery.trim() !== '' && (
					<Typography variant="caption" className="text-secondary mt-3 block tabular-nums">
						{totalReports} match{totalReports === 1 ? '' : 'es'}
					</Typography>
				)}
			</Box>
		</PlanFeatureGate>
	);
}
