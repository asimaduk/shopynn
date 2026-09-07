/**
 * Hooks that provide project dashboard data from static source (no API).
 */

import projectDashboardWidgets, { projectDashboardProjects } from './analyticsDashboardData';

export function useAnalyticsDashboardWidgets() {
	return {
		data: projectDashboardWidgets,
		isLoading: false,
		isSuccess: true
	};
}

export function useAnalyticsDashboardProjects() {
	return {
		data: projectDashboardProjects,
		isLoading: false,
		isSuccess: true
	};
}
