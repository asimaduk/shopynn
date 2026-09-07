import { redirect } from 'next/navigation';

/** @deprecated Use `/reports` — Reports live outside Settings. */
export default function LegacyReportsRedirect() {
	redirect('/reports');
}
