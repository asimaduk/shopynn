import { redirect } from 'next/navigation';

/** Fuse mock account form — real profile lives under /apps/profile. */
export default function SettingsAccountPage() {
	redirect('/apps/profile');
}
