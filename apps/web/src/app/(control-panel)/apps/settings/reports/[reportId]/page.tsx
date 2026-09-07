import { redirect } from 'next/navigation';

/** @deprecated Use `/reports/[reportId]` — Reports live outside Settings. */
export default async function LegacyReportDetailRedirect({ params }: { params: Promise<{ reportId: string }> }) {
	const { reportId } = await params;
	redirect(`/reports/${reportId}`);
}
