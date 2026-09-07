import { redirect } from 'next/navigation';

function AppsPage() {
	redirect(`/inventory/products`);
	return null;
}

export default AppsPage;
