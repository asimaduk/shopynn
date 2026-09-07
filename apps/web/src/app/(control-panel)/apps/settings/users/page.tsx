import { redirect } from 'next/navigation';

export default function SettingsUsersPage() {
	redirect('/users/staff');
	return null;
}
