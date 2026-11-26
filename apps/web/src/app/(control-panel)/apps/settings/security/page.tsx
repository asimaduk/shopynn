import { redirect } from 'next/navigation';

/** Fuse mock security form — real password change lives under profile. */
export default function SettingsSecurityPage() {
	redirect('/apps/profile/change-password');
}
