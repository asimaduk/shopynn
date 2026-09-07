import { redirect } from 'next/navigation';

export default function NewUserPage() {
	redirect('/users/staff');
	return null;
}
