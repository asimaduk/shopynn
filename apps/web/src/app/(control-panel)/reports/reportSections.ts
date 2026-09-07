import { User } from '@auth/user';
import { hasPermissionCodes } from '@auth/permissions';

export type ReportNavItem = {
	id: string;
	title: string;
	description: string;
	icon: string;
	/** Navigate to app route instead of report detail */
	href?: string;
};

export type ReportSection = {
	title: string;
	color: string;
	reports: ReportNavItem[];
};

export const REPORT_SECTIONS: ReportSection[] = [
	{
		title: 'Inventory',
		color: '#7c3aed',
		reports: [
			{
				id: 'stock-summary',
				title: 'Stock summary',
				description: 'Current stock levels by product and category',
				icon: 'heroicons-outline:cube'
			}
		]
	},
	{
		title: 'Sales & revenue',
		color: '#10b981',
		reports: [
			{
				id: 'daily-sales',
				title: 'Daily sales',
				description: 'Daily sales totals chart and breakdown',
				icon: 'heroicons-outline:chart-bar',
				href: '/dashboards/analytics/daily-sales'
			},
			{
				id: 'sales-summary',
				title: 'Sales summary',
				description: 'Sales by period, product, and store',
				icon: 'heroicons-outline:shopping-cart'
			},
			{
				id: 'top-products',
				title: 'Top selling products',
				description: 'Best sellers by quantity or value',
				icon: 'heroicons-outline:arrow-trending-up'
			},
			{
				id: 'sales-by-customer',
				title: 'Sales by customer',
				description: 'Who bought what and when',
				icon: 'heroicons-outline:users'
			},
			{
				id: 'sales-by-staff',
				title: 'Sales by staff / cashier',
				description: 'Totals by staff or cashier',
				icon: 'heroicons-outline:user'
			}
		]
	},
	{
		title: 'Purchases & costs',
		color: '#f59e0b',
		reports: [
			{
				id: 'purchase-summary',
				title: 'Purchase summary',
				description: 'Purchases by supplier and period',
				icon: 'heroicons-outline:truck'
			}
		]
	},
	{
		title: 'Operations',
		color: '#6366f1',
		reports: [
			{
				id: 'transfers',
				title: 'Transfer report',
				description: 'Stock transfers between locations',
				icon: 'heroicons-outline:arrow-path-rounded-square'
			},
			{
				id: 'adjustments',
				title: 'Adjustments history',
				description: 'Inventory adjustments and reasons',
				icon: 'heroicons-outline:minus-circle'
			},
			{
				id: 'audit-trail',
				title: 'Audit trail',
				description: 'Who did what and when',
				icon: 'heroicons-outline:clock'
			}
		]
	},
	{
		title: 'Financial',
		color: '#0ea5e9',
		reports: [
			{
				id: 'profit-loss',
				title: 'Profit & loss',
				description: 'Income, expenses, and net profit',
				icon: 'heroicons-outline:chart-pie'
			}
		]
	}
];

function canSeeReport(user: User | null | undefined, report: ReportNavItem): boolean {
	if (report.id === 'audit-trail') {
		return hasPermissionCodes(user, ['audit_logs.view', 'audit.view']);
	}
	return hasPermissionCodes(user, 'reports.view');
}

export function getReportTitle(reportId: string): string {
	for (const section of REPORT_SECTIONS) {
		const hit = section.reports.find((r) => r.id === reportId);
		if (hit) return hit.title;
	}
	return reportId;
}

/** Section tint for report detail UI (matches list grouping). */
export function getReportAccentColor(reportId: string): string {
	for (const section of REPORT_SECTIONS) {
		if (section.reports.some((r) => r.id === reportId)) {
			return section.color;
		}
	}
	return '#6366f1';
}

export function getVisibleReportSections(user: User | null | undefined): ReportSection[] {
	return REPORT_SECTIONS.map((section) => ({
		...section,
		reports: section.reports.filter((r) => canSeeReport(user, r))
	})).filter((s) => s.reports.length > 0);
}
