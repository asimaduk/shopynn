'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useUser from '@auth/useUser';
import Link from 'next/link';
import { getVisibleReportSections, ReportNavItem } from './reportSections';

function ReportCardLink(props: { report: ReportNavItem; sectionColor: string }) {
	const { report, sectionColor } = props;
	const theme = useTheme();

	const inner = (
		<Card
			elevation={0}
			className="h-full overflow-hidden transition-all duration-200 ease-out"
			sx={{
				border: `1px solid ${theme.palette.divider}`,
				borderRadius: 2,
				background:
					theme.palette.mode === 'dark'
						? alpha(theme.palette.background.paper, 0.6)
						: theme.palette.background.paper,
				'&:hover': {
					borderColor: alpha(sectionColor, 0.55),
					boxShadow: `0 12px 40px -12px ${alpha(sectionColor, 0.35)}`,
					transform: 'translateY(-2px)'
				}
			}}
		>
			<CardActionArea className="h-full items-stretch" sx={{ alignItems: 'stretch' }}>
				<Box
					className="flex flex-row items-stretch gap-0"
					sx={{
						borderLeft: `3px solid ${sectionColor}`
					}}
				>
					<Box
						className="flex items-center justify-center shrink-0 px-16 py-20"
						sx={{
							background: alpha(sectionColor, theme.palette.mode === 'dark' ? 0.12 : 0.08)
						}}
					>
						<FuseSvgIcon sx={{ color: sectionColor }} size={26}>
							{report.icon}
						</FuseSvgIcon>
					</Box>
					<Box className="flex flex-1 flex-col justify-center gap-4 py-16 pr-12 pl-16 min-w-0">
						<Typography className="font-semibold leading-snug" variant="subtitle1">
							{report.title}
						</Typography>
						<Typography className="text-secondary text-sm leading-relaxed line-clamp-2">
							{report.description}
						</Typography>
					</Box>
					<Box className="flex items-center pr-12 shrink-0">
						<FuseSvgIcon className="text-secondary opacity-70" size={20}>
							heroicons-outline:chevron-right
						</FuseSvgIcon>
					</Box>
				</Box>
			</CardActionArea>
		</Card>
	);

	const wrap = (node: React.ReactNode) =>
		report.href ? (
			<Link href={report.href} className="block h-full no-underline text-inherit">
				{node}
			</Link>
		) : (
			<Link href={`/reports/${report.id}`} className="block h-full no-underline text-inherit">
				{node}
			</Link>
		);

	return wrap(inner);
}

export default function ReportsListPage() {
	const theme = useTheme();
	const { data: user } = useUser();
	const [searchQuery, setSearchQuery] = useState('');

	const visibleSections = useMemo(() => getVisibleReportSections(user), [user]);

	const filteredSections = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return visibleSections;
		return visibleSections
			.map((section) => {
				const reports = section.reports.filter(
					(r) =>
						r.title.toLowerCase().includes(q) ||
						r.description.toLowerCase().includes(q) ||
						section.title.toLowerCase().includes(q)
				);
				return reports.length ? { ...section, reports } : null;
			})
			.filter(Boolean) as typeof visibleSections;
	}, [searchQuery, visibleSections]);

	const totalReports = useMemo(
		() => filteredSections.reduce((n, s) => n + s.reports.length, 0),
		[filteredSections]
	);

	return (
		<PlanFeatureGate
			requiredPermissions={['reports.view']}
			requiredFeatures={['reports.view']}
			featureTitle="Reports"
			backHref="/dashboards/analytics"
		>
			<Box className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-12">
				{/* Hero */}
				<Paper
					elevation={0}
					className="overflow-hidden rounded-2xl mb-8 sm:mb-10"
					sx={{
						background:
							theme.palette.mode === 'dark'
								? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.12)} 100%)`
								: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
						border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
					}}
				>
					<Box className="px-6 py-8 sm:px-10 sm:py-10">
						<Box className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
							<Box className="max-w-2xl">
								<Typography
									variant="overline"
									className="tracking-widest font-semibold mb-2 block"
									sx={{ color: theme.palette.primary.main }}
								>
									Analytics
								</Typography>
								<Typography variant="h4" className="font-bold tracking-tight">
									Reports
								</Typography>
								<Typography className="text-secondary mt-3 text-base leading-relaxed">
									Browse inventory, sales, purchases, operations, and financial reports—aligned with the
									mobile app catalog.
								</Typography>
							</Box>
							<Chip
								size="medium"
								label={`${totalReports} report${totalReports === 1 ? '' : 's'}`}
								sx={{
									alignSelf: 'flex-start',
									fontWeight: 600,
									bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.15 : 0.85),
									border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
								}}
							/>
						</Box>

						<TextField
							className="mt-8 w-full max-w-xl"
							size="medium"
							placeholder="Search by name, category, or description…"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							autoComplete="off"
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<FuseSvgIcon size={22} color="action">
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
											<FuseSvgIcon size={18}>heroicons-outline:x-mark</FuseSvgIcon>
										</IconButton>
									</InputAdornment>
								) : null,
								sx: {
									borderRadius: 3,
									bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.4 : 0.95)
								}
							}}
						/>
					</Box>
				</Paper>

				{/* Sections */}
				<Box className="flex flex-col gap-10 sm:gap-12">
					{filteredSections.map((section) => (
						<Box key={section.title}>
							<Box className="flex items-center gap-3 mb-4 sm:mb-5">
								<Box
									className="h-2 w-2 rounded-full shrink-0"
									sx={{ bgcolor: section.color, boxShadow: `0 0 0 3px ${alpha(section.color, 0.25)}` }}
								/>
								<Typography
									variant="subtitle2"
									className="font-bold uppercase tracking-wider"
									sx={{ color: 'text.secondary', letterSpacing: '0.06em' }}
								>
									{section.title}
								</Typography>
								<Box className="flex-1 h-px bg-divider opacity-60" />
								<Typography variant="caption" className="text-secondary tabular-nums">
									{section.reports.length}
								</Typography>
							</Box>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
								{section.reports.map((report) => (
									<ReportCardLink key={report.id} report={report} sectionColor={section.color} />
								))}
							</div>
						</Box>
					))}
				</Box>

				{filteredSections.length === 0 && (
					<Paper
						elevation={0}
						className="mt-8 rounded-2xl border border-dashed"
						sx={{ borderColor: 'divider' }}
					>
						<Box className="flex flex-col items-center justify-center py-16 px-6 text-center">
							<Box
								className="rounded-full flex items-center justify-center mb-5"
								sx={{
									width: 72,
									height: 72,
									bgcolor: alpha(theme.palette.primary.main, 0.08)
								}}
							>
								<FuseSvgIcon size={36} sx={{ color: 'text.secondary', opacity: 0.7 }}>
									heroicons-outline:magnifying-glass
								</FuseSvgIcon>
							</Box>
							<Typography variant="h6" className="font-semibold">
								No reports match your search
							</Typography>
							<Typography className="text-secondary text-sm mt-2 max-w-sm">
								Try another keyword, or clear the filter to see everything again.
							</Typography>
							{searchQuery.trim() !== '' && (
								<Chip
									className="mt-6"
									label="Clear search"
									onClick={() => setSearchQuery('')}
									variant="outlined"
									clickable
								/>
							)}
						</Box>
					</Paper>
				)}
			</Box>
		</PlanFeatureGate>
	);
}
