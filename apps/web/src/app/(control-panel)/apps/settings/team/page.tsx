import { redirect } from 'next/navigation';

/** Fuse mock team list — real staff management lives under Users. */
export default function SettingsTeamPage() {
	redirect('/users/staff');
}
