import { redirect } from 'next/navigation';

export default function LegacySubscriptionPaymentsPage() {
	redirect('/apps/profile/payments');
}
