import { redirect } from 'next/navigation';

/** Fuse mock billing form — real subscription/billing lives on profile. */
export default function SettingsPlanBillingPage() {
	redirect('/apps/profile');
}
