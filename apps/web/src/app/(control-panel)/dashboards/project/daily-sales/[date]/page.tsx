import { redirect } from 'next/navigation';

export default function SaleDetailRedirect({ params }: { params: { date: string } }) {
	redirect(`/dashboards/analytics/daily-sales/${params.date}`);
	return null;
}

