'use client';

import { useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';

const MESSAGES: Record<string, string> = {
	idle: 'You were signed out due to inactivity. Sign in again to continue.',
	expired: 'Your session has expired. Sign in again to continue.'
};

export default function IdleSignInNotice() {
	const params = useSearchParams();
	const message = MESSAGES[params.get('reason') ?? ''];
	if (!message) return null;
	return (
		<Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
			{message}
		</Alert>
	);
}
