import { redirect } from 'next/navigation';

export default function LegacySubscriptionCardPaymentPage() {
	redirect('/apps/profile/billing/payment/card');
}
