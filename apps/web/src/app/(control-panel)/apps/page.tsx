import { redirect } from 'next/navigation';

function AppsPage() {
	redirect('/apps/settings');
	return null;
}

export default AppsPage;
