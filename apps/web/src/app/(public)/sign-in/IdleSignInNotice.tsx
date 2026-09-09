'use client';

import { useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';

export default function IdleSignInNotice() {
	const params = useSearchParams();
	if (params.get('reason') !== 'idle') return null;
	return (
		<Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
			You were signed out due to inactivity. Sign in again to continue.
		</Alert>
	);
}
