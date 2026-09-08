import { redirect } from 'next/navigation';

export default async function SaleDetailRedirect({
	params
}: {
	params: Promise<{ date: string }>;
}) {
	const { date } = await params;
	redirect(`/dashboards/analytics/daily-sales/${date}`);
}
