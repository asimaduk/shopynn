import { redirect } from 'next/navigation';

export default function DailySalesRedirect() {
	redirect('/dashboards/analytics/daily-sales');
	return null;
}

