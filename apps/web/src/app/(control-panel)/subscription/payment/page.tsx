import { redirect } from 'next/navigation';

export default function LegacySubscriptionPaymentPage() {
	redirect('/apps/profile/billing/payment');
}
