import { notFound } from 'next/navigation';
import ReportDetailView from '../ReportDetailView';
import { isValidReportId } from '../reportIds';
import { getReportTitle } from '../reportSections';

export default async function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
	const { reportId } = await params;
	if (!isValidReportId(reportId)) {
		notFound();
	}
	return <ReportDetailView reportId={reportId} title={getReportTitle(reportId)} />;
}
