import { redirect } from 'next/navigation';

export default function ProjectDashboardRedirect() {
	redirect('/dashboards/analytics');
	return null;
}
