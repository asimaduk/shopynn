/**
 * Static dashboard data for the inventory management dashboard (no mock API).
 * Replace with real API calls when backend is ready.
 */

import inventoryDashboardWidgets from './inventoryDashboardData';
import type { InventoryDashboardWidgets } from './inventoryDashboardData';

export type ProjectDashboardWidgets = InventoryDashboardWidgets;
export type ProjectType = { id: number; name: string };

const projectDashboardWidgets: ProjectDashboardWidgets = inventoryDashboardWidgets;

export const projectDashboardProjects: ProjectType[] = [
	{ id: 1, name: 'Main Warehouse' },
	{ id: 2, name: 'Store A' },
	{ id: 3, name: 'Store B' }
];

export default projectDashboardWidgets;
