import { redirect } from 'next/navigation';

/** @deprecated Use `/notifications` — Notifications live outside Settings. */
export default function LegacyNotificationsRedirect() {
	redirect('/notifications');
}
