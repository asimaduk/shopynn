/**
 * Project dashboard types only. Data is provided by useProjectDashboardData hooks (static data, no API).
 */

import BudgetDistributionDataType from './tabs/budget/widgets/types/BudgetDistributionDataType';
import ExpensesDataType from './tabs/budget/widgets/types/ExpensesDataType';
import BudgetDetailsDataType from './tabs/budget/widgets/types/BudgetDetailsDataType';
import WidgetDataType from './tabs/home/widgets/types/WidgetDataType';
import GithubIssuesDataType from './tabs/home/widgets/types/GithubIssuesDataType';
import ScheduleDataType from './tabs/home/widgets/types/ScheduleDataType';
import TaskDistributionDataType from './tabs/home/widgets/types/TaskDistributionDataType';
import TeamMemberType from './tabs/team/widgets/types/TeamMemberType';

export type ProjectDashboardWidgetType =
	| BudgetDetailsDataType
	| BudgetDistributionDataType
	| ExpensesDataType
	| WidgetDataType
	| GithubIssuesDataType
	| ScheduleDataType
	| TaskDistributionDataType
	| TeamMemberType[];

export type GetProjectDashboardWidgetsApiResponse = Record<string, ProjectDashboardWidgetType>;
export type GetProjectDashboardWidgetsApiArg = void;
export type GetProjectDashboardProjectsApiResponse = ProjectType[];
export type GetProjectDashboardProjectsApiArg = void;

export type ProjectType = {
	id: number;
	name: string;
};
