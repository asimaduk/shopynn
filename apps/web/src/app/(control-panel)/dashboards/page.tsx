import { redirect } from 'next/navigation';

function DashboardsPage() {
	redirect(`/dashboards/analytics`);
	return null;
}

export default DashboardsPage;
