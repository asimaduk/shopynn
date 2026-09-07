import { redirect } from 'next/navigation';

export default function EditUserPage() {
	redirect('/users/staff');
	return null;
}
